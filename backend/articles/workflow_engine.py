import json
import logging
import re
import threading
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache
from django.db import close_old_connections

from .models import AgentExecution, LogEntry, WorkflowRun, default_workflow_data

logger = logging.getLogger(__name__)

AGENT_SOURCE_LABELS = {
    AgentExecution.AgentName.AUTHOR: "Author",
    AgentExecution.AgentName.EDITOR: "Editor",
    AgentExecution.AgentName.FACT_CHECKER: "FactChecker",
    AgentExecution.AgentName.COPY_EDITOR: "CopyEditor",
}

OPENROUTER_RATE_LIMIT_CACHE_KEY = "articles.openrouter.rate_limited_until"


def launch_workflow(workflow_id: str) -> None:
    if getattr(settings, "WORKFLOW_SYNC_EXECUTION", False):
        run_workflow(workflow_id)
        return

    worker = threading.Thread(
        target=run_workflow,
        args=(workflow_id,),
        daemon=True,
        name=f"workflow-{workflow_id}",
    )
    worker.start()


class AgentProvider:
    def __init__(self) -> None:
        self.api_key = getattr(settings, "OPENROUTER_API_KEY", "")
        self.model = getattr(settings, "OPENROUTER_MODEL", "openai/gpt-4o-mini")
        self.rate_limit_cooldown_seconds = max(
            0,
            int(getattr(settings, "OPENROUTER_RATE_LIMIT_COOLDOWN_SECONDS", 60)),
        )
        self._openrouter_disabled = False
        self._openrouter_disable_reason = ""
        self._openrouter_disable_logged = False

    def author(
        self,
        bullet_points: list[str],
        revision_round: int,
        feedback: str,
    ) -> dict[str, str]:
        llm_response = self._call_json_via_openrouter(
            system_prompt=(
                "You are Author in a newsroom workflow. Return ONLY valid JSON with this exact "
                'shape: {"draft":"string"}.'
            ),
            user_prompt=(
                f"bullet_points: {json.dumps(bullet_points)}\n"
                f"revision_round: {revision_round}\n"
                f"editor_feedback: {feedback}"
            ),
        )
        if llm_response is not None:
            return normalize_author_output(llm_response)

        cleaned = [point.strip("- ").strip() for point in bullet_points if point.strip()]
        if not cleaned:
            return {"draft": "No bullet points were provided for drafting."}

        lead = cleaned[0]
        details = cleaned[1:]

        paragraphs = [
            f"{lead}.",
            "This first draft expands the core points into a coherent newsroom narrative.",
        ]
        if details:
            paragraphs.append(f"Key details include: {', '.join(details)}.")
        if revision_round > 0 and feedback:
            paragraphs.append(f"Revision applied based on editor feedback: {feedback}")

        return {"draft": "\n\n".join(paragraphs)}

    def editor(
        self,
        draft: str,
        revision_round: int,
        fact_flags: list[dict[str, str]],
        mode: str,
    ) -> dict[str, Any]:
        llm_response = self._call_json_via_openrouter(
            system_prompt=(
                "You are Editor in a newsroom workflow. Return ONLY valid JSON with this exact "
                'shape: {"draft":"string","feedback":"string","needs_revision":true|false}.'
            ),
            user_prompt=(
                f"mode: {mode}\n"
                f"revision_round: {revision_round}\n"
                f"fact_flags: {json.dumps(fact_flags)}\n"
                f"draft:\n{draft}"
            ),
        )
        if llm_response is not None:
            return normalize_editor_output(llm_response)

        revised_draft = draft.strip()

        if fact_flags:
            for flag in fact_flags:
                flagged_text = str(flag.get("text", "")).strip()
                if flagged_text:
                    revised_draft = revised_draft.replace(
                        flagged_text,
                        "A previously unverified claim was removed pending verification.",
                    )
            return {
                "draft": revised_draft,
                "feedback": "Claims flagged by fact-checking were revised or removed.",
                "needs_revision": False,
            }

        if revision_round == 0:
            revised_draft = (
                f"{revised_draft}\n\n"
                "Editor note applied: tighten transitions between the lead and supporting details."
            )
            return {
                "draft": revised_draft,
                "feedback": "Please revise once to improve flow and transitions.",
                "needs_revision": True,
            }

        return {
            "draft": revised_draft,
            "feedback": "Draft approved for fact checking.",
            "needs_revision": False,
        }

    def fact_checker(self, draft: str, review_round: int) -> dict[str, list[dict[str, str]]]:
        llm_response = self._call_json_via_openrouter(
            system_prompt=(
                "You are FactChecker in a newsroom workflow. Return ONLY valid JSON with this "
                'exact shape: {"flags":[{"text":"string","reason":"string"}]}. '
                "If there are no issues return {\"flags\": []}."
            ),
            user_prompt=f"review_round: {review_round}\n\ndraft:\n{draft}",
        )
        if llm_response is not None:
            return normalize_fact_checker_output(llm_response)

        flags: list[dict[str, str]] = []
        numeric_pattern = re.compile(r"\b\d+(?:\.\d+)?%?\b")
        claim_keywords = ("study", "studies", "according to", "research shows", "experts say")

        sentences = [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", draft) if chunk.strip()]
        for sentence in sentences:
            lowered = sentence.lower()
            has_numeric_claim = bool(numeric_pattern.search(sentence))
            has_keyword_claim = any(keyword in lowered for keyword in claim_keywords)
            if not has_numeric_claim and not has_keyword_claim:
                continue

            flags.append(
                {
                    "text": sentence[:240],
                    "reason": "Claim appears factual and should be independently verified.",
                }
            )
            if len(flags) >= 4:
                break

        return {"flags": flags}

    def copy_editor(self, draft: str) -> dict[str, str]:
        llm_response = self._call_json_via_openrouter(
            system_prompt=(
                "You are CopyEditor in a newsroom workflow. Return ONLY valid JSON with this "
                'exact shape: {"final_article":"string"}.'
            ),
            user_prompt=f"draft:\n{draft}",
        )
        if llm_response is not None:
            return normalize_copy_editor_output(llm_response)

        normalized_whitespace = re.sub(r"\n{3,}", "\n\n", draft.strip())
        return {"final_article": normalized_whitespace}

    def _call_json_via_openrouter(self, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        if not self.api_key:
            return None

        now = time.time()
        try:
            global_disabled_until = cache.get(OPENROUTER_RATE_LIMIT_CACHE_KEY)
        except Exception:  # noqa: BLE001
            global_disabled_until = None

        if global_disabled_until is not None:
            try:
                global_disabled_until = float(global_disabled_until)
            except (TypeError, ValueError):
                global_disabled_until = None

        if global_disabled_until and global_disabled_until > now:
            self._openrouter_disabled = True
            self._openrouter_disable_reason = "global HTTP 429 cooldown"

        if self._openrouter_disabled:
            if not self._openrouter_disable_logged:
                reason = self._openrouter_disable_reason or "a previous provider error"
                logger.debug(
                    "OpenRouter disabled for this workflow run after %s; using local fallback.",
                    reason,
                )
                self._openrouter_disable_logged = True
            return None

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }

        request = Request(
            url="https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://multi-agent-demo-system.local",
                "X-Title": "Multi-Agent Newsroom",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=45) as response:
                body = json.loads(response.read().decode("utf-8"))
            message = body["choices"][0]["message"]["content"]
            return extract_json_dict(message)
        except HTTPError as exc:
            if exc.code == 429:
                self._openrouter_disabled = True
                self._openrouter_disable_reason = "HTTP 429 rate limit"
                if self.rate_limit_cooldown_seconds > 0:
                    try:
                        cache.set(
                            OPENROUTER_RATE_LIMIT_CACHE_KEY,
                            now + self.rate_limit_cooldown_seconds,
                            timeout=self.rate_limit_cooldown_seconds,
                        )
                    except Exception:  # noqa: BLE001
                        logger.debug("Failed to persist OpenRouter cooldown in cache.")
                logger.info(
                    "OpenRouter rate-limited (HTTP 429); disabling remote provider for this workflow run, "
                    "backing off for %ss, and falling back to local agents.",
                    self.rate_limit_cooldown_seconds,
                )
                return None
            logger.warning("OpenRouter request failed, falling back to local agent: %s", exc)
            return None
        except (URLError, TimeoutError, ValueError, KeyError) as exc:
            logger.warning("OpenRouter request failed, falling back to local agent: %s", exc)
            return None


def run_workflow(workflow_id: str) -> None:
    close_old_connections()
    provider = AgentProvider()

    try:
        workflow = WorkflowRun.objects.get(pk=workflow_id)
    except WorkflowRun.DoesNotExist:
        logger.error("Workflow %s not found", workflow_id)
        close_old_connections()
        return

    try:
        _log(workflow, source="System", message="Workflow started.", log_type=LogEntry.Type.INFO)
        _update_workflow(workflow, status=WorkflowRun.Status.RUNNING, current_step=WorkflowRun.Step.AUTHOR)
        _update_workflow(workflow, data_patch=default_workflow_data())

        draft = ""
        feedback = ""
        author_editor_round = 0
        max_author_editor_loops = getattr(settings, "WORKFLOW_MAX_EDITOR_AUTHOR_LOOPS", 2)

        while True:
            _update_workflow(workflow, current_step=WorkflowRun.Step.AUTHOR)
            author_output = _execute_agent(
                workflow=workflow,
                agent_name=AgentExecution.AgentName.AUTHOR,
                agent_input={"bullet_points": workflow.bullet_points},
                execute=lambda author_editor_round=author_editor_round, feedback=feedback: provider.author(
                    workflow.bullet_points,
                    author_editor_round,
                    feedback,
                ),
            )
            draft = author_output["draft"]
            _update_workflow(workflow, data_patch={"draft": draft})

            _update_workflow(workflow, current_step=WorkflowRun.Step.EDITOR)
            editor_output = _execute_agent(
                workflow=workflow,
                agent_name=AgentExecution.AgentName.EDITOR,
                agent_input={"draft": draft},
                execute=lambda draft=draft, author_editor_round=author_editor_round: provider.editor(
                    draft=draft,
                    revision_round=author_editor_round,
                    fact_flags=[],
                    mode="author_revision",
                ),
            )
            draft = editor_output["draft"]
            feedback = editor_output["feedback"]
            _update_workflow(workflow, data_patch={"draft": draft})

            if not editor_output["needs_revision"]:
                break

            author_editor_round += 1
            _log(
                workflow,
                source="Editor",
                message=f"Revision requested: {feedback}",
                log_type=LogEntry.Type.ACTION,
            )
            if author_editor_round > max_author_editor_loops:
                raise RuntimeError("Editor/Author loop exceeded configured limit.")

        fact_editor_round = 0
        max_fact_editor_loops = getattr(settings, "WORKFLOW_MAX_FACT_EDITOR_LOOPS", 3)

        while True:
            _update_workflow(workflow, current_step=WorkflowRun.Step.FACT_CHECKER)
            fact_output = _execute_agent(
                workflow=workflow,
                agent_name=AgentExecution.AgentName.FACT_CHECKER,
                agent_input={"draft": draft},
                execute=lambda draft=draft, fact_editor_round=fact_editor_round: provider.fact_checker(
                    draft,
                    fact_editor_round,
                ),
            )
            flags = fact_output["flags"]
            _update_workflow(workflow, data_patch={"flags": flags})

            if not flags:
                _log(
                    workflow,
                    source="FactChecker",
                    message="No remaining factual flags.",
                    log_type=LogEntry.Type.INFO,
                )
                break

            fact_editor_round += 1
            if fact_editor_round > max_fact_editor_loops:
                raise RuntimeError("FactChecker/Editor loop exceeded configured limit.")

            _log(
                workflow,
                source="FactChecker",
                message=f"Flagged {len(flags)} claim(s) for revision.",
                log_type=LogEntry.Type.ACTION,
            )

            _update_workflow(workflow, current_step=WorkflowRun.Step.EDITOR)
            editor_output = _execute_agent(
                workflow=workflow,
                agent_name=AgentExecution.AgentName.EDITOR,
                agent_input={"draft": draft},
                execute=lambda draft=draft, author_editor_round=author_editor_round, flags=flags: provider.editor(
                    draft=draft,
                    revision_round=author_editor_round,
                    fact_flags=flags,
                    mode="fact_revision",
                ),
            )
            draft = editor_output["draft"]
            _update_workflow(workflow, data_patch={"draft": draft})

        _update_workflow(workflow, current_step=WorkflowRun.Step.COPY_EDITOR)
        copy_editor_output = _execute_agent(
            workflow=workflow,
            agent_name=AgentExecution.AgentName.COPY_EDITOR,
            agent_input={"draft": draft},
            execute=lambda: provider.copy_editor(draft),
        )

        _update_workflow(
            workflow,
            status=WorkflowRun.Status.COMPLETED,
            data_patch={
                "draft": draft,
                "flags": [],
                "final_article": copy_editor_output["final_article"],
            },
        )
        _log(workflow, source="System", message="Workflow completed.", log_type=LogEntry.Type.INFO)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Workflow %s failed", workflow_id)
        _update_workflow(workflow, status=WorkflowRun.Status.FAILED)
        _log(
            workflow,
            source="System",
            message=f"Workflow failed: {exc}",
            log_type=LogEntry.Type.ERROR,
        )
    finally:
        close_old_connections()


def _execute_agent(
    workflow: WorkflowRun,
    agent_name: str,
    agent_input: dict[str, Any],
    execute,
) -> dict[str, Any]:
    execution = AgentExecution.objects.create(
        workflow=workflow,
        agent_name=agent_name,
        input=agent_input,
        output={},
        status=AgentExecution.Status.RUNNING,
    )

    source = AGENT_SOURCE_LABELS[agent_name]
    _log(workflow, source=source, message="Started step execution.", log_type=LogEntry.Type.ACTION)

    try:
        output = execute()
        execution.output = output
        execution.status = AgentExecution.Status.COMPLETED
        execution.save(update_fields=["output", "status", "updated_at"])
        _log(workflow, source=source, message="Completed step execution.", log_type=LogEntry.Type.ACTION)
        return output
    except Exception as exc:  # noqa: BLE001
        execution.output = {"error": str(exc)}
        execution.status = AgentExecution.Status.FAILED
        execution.save(update_fields=["output", "status", "updated_at"])
        _log(
            workflow,
            source=source,
            message=f"Step failed: {exc}",
            log_type=LogEntry.Type.ERROR,
        )
        raise


def _update_workflow(
    workflow: WorkflowRun,
    status: str | None = None,
    current_step: str | None = None,
    data_patch: dict[str, Any] | None = None,
) -> None:
    fields = ["updated_at"]

    if status is not None and workflow.status != status:
        workflow.status = status
        fields.append("status")

    if current_step is not None and workflow.current_step != current_step:
        workflow.current_step = current_step
        fields.append("current_step")

    if data_patch is not None:
        current_data = default_workflow_data()
        current_data.update(workflow.data or {})
        current_data.update(data_patch)
        workflow.data = current_data
        fields.append("data")

    workflow.save(update_fields=fields)


def _log(workflow: WorkflowRun, source: str, message: str, log_type: str) -> None:
    LogEntry.objects.create(workflow=workflow, source=source, message=message, type=log_type)


def extract_json_dict(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")

    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON is not an object")
    return parsed


def normalize_author_output(payload: dict[str, Any]) -> dict[str, str]:
    draft = str(payload.get("draft", "")).strip()
    if not draft:
        draft = "Author produced an empty draft."
    return {"draft": draft}


def normalize_editor_output(payload: dict[str, Any]) -> dict[str, Any]:
    draft = str(payload.get("draft", "")).strip() or "Editor returned an empty draft."
    feedback = str(payload.get("feedback", "")).strip() or "No feedback provided."
    needs_revision = bool(payload.get("needs_revision", False))
    return {
        "draft": draft,
        "feedback": feedback,
        "needs_revision": needs_revision,
    }


def normalize_fact_checker_output(payload: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    flags_payload = payload.get("flags", [])
    if not isinstance(flags_payload, list):
        return {"flags": []}

    normalized_flags: list[dict[str, str]] = []
    for item in flags_payload:
        if not isinstance(item, dict):
            continue

        text = str(item.get("text", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if not text or not reason:
            continue

        normalized_flags.append({"text": text, "reason": reason})

    return {"flags": normalized_flags}


def normalize_copy_editor_output(payload: dict[str, Any]) -> dict[str, str]:
    final_article = str(payload.get("final_article", "")).strip()
    if not final_article:
        final_article = "Copy editor returned an empty final article."
    return {"final_article": final_article}
