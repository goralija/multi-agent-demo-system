import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from urllib.error import HTTPError

from .models import AgentExecution, Article, WorkflowRun
from .workflow_engine import AgentProvider


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_health(client: APIClient) -> None:
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.django_db
def test_create_and_list_article(client: APIClient) -> None:
    payload = {"title": "Demo", "bullet_points": "- one\n- two"}
    resp = client.post(reverse("article-list"), payload, format="json")
    assert resp.status_code == 201, resp.content
    assert Article.objects.count() == 1

    resp = client.get(reverse("article-list"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["results"][0]["title"] == "Demo"


@pytest.mark.django_db
def test_add_agent_comment(client: APIClient) -> None:
    article = Article.objects.create(title="X", bullet_points="- a")
    url = reverse("article-add-comment", kwargs={"pk": article.pk})
    resp = client.post(url, {"agent": "editor", "body": "Tighten the lede."}, format="json")
    assert resp.status_code == 201
    assert article.comments.count() == 1


@pytest.mark.django_db
@override_settings(WORKFLOW_SYNC_EXECUTION=True, OPENROUTER_API_KEY="")
def test_start_workflow_and_retrieve_state(client: APIClient) -> None:
    payload = {
        "bullet_points": [
            "City council approved a new public transit plan",
            "The proposal includes two new tram lines",
        ]
    }
    start_resp = client.post(reverse("workflow-list"), payload, format="json")
    assert start_resp.status_code == 201, start_resp.content

    workflow_id = start_resp.json()["id"]
    detail_resp = client.get(reverse("workflow-detail", kwargs={"pk": workflow_id}))
    assert detail_resp.status_code == 200, detail_resp.content

    data = detail_resp.json()
    assert data["status"] == WorkflowRun.Status.COMPLETED
    assert data["data"]["final_article"]
    assert len(data["agents"]) == 4
    assert all(agent["status"] == "completed" for agent in data["agents"])


@pytest.mark.django_db
@override_settings(WORKFLOW_SYNC_EXECUTION=True, OPENROUTER_API_KEY="")
def test_workflow_logs_endpoint_returns_activity(client: APIClient) -> None:
    payload = {"bullet_points": ["A local team won the national finals", "Attendance was strong"]}
    start_resp = client.post(reverse("workflow-list"), payload, format="json")
    workflow_id = start_resp.json()["id"]

    logs_resp = client.get(reverse("workflow-logs", kwargs={"pk": workflow_id}))
    assert logs_resp.status_code == 200, logs_resp.content
    logs = logs_resp.json()
    assert logs
    assert any(log["source"] == "Author" for log in logs)
    assert any(log["source"] == "System" for log in logs)


@pytest.mark.django_db
def test_start_workflow_requires_non_empty_bullets(client: APIClient) -> None:
    payload = {"bullet_points": ["", "   "]}
    response = client.post(reverse("workflow-list"), payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
@override_settings(WORKFLOW_SYNC_EXECUTION=True, OPENROUTER_API_KEY="")
def test_fact_checker_editor_loop_runs_when_flags_found(client: APIClient) -> None:
    payload = {
        "bullet_points": [
            "A report claims 78% of residents support the reform",
            "According to a recent study, commute times dropped by 15%",
        ]
    }
    start_resp = client.post(reverse("workflow-list"), payload, format="json")
    workflow_id = start_resp.json()["id"]
    workflow = WorkflowRun.objects.get(pk=workflow_id)

    fact_checker_runs = AgentExecution.objects.filter(
        workflow=workflow,
        agent_name=AgentExecution.AgentName.FACT_CHECKER,
    ).count()
    editor_runs = AgentExecution.objects.filter(
        workflow=workflow,
        agent_name=AgentExecution.AgentName.EDITOR,
    ).count()

    assert workflow.status == WorkflowRun.Status.COMPLETED
    assert fact_checker_runs >= 1
    assert editor_runs >= 2


def test_provider_disables_openrouter_after_429(monkeypatch: pytest.MonkeyPatch) -> None:
    call_count = 0

    def fake_urlopen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise HTTPError(
            url="https://openrouter.ai/api/v1/chat/completions",
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )

    monkeypatch.setattr("articles.workflow_engine.urlopen", fake_urlopen)

    provider = AgentProvider()
    provider.api_key = "test-key"

    author_output = provider.author(["City council approved new transit routes"], revision_round=0, feedback="")
    editor_output = provider.editor(
        draft=author_output["draft"],
        revision_round=0,
        fact_flags=[],
        mode="author_revision",
    )

    assert call_count == 1
    assert author_output["draft"]
    assert editor_output["draft"]


def test_provider_uses_global_429_cooldown(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeCache:
        def __init__(self) -> None:
            self.data: dict[str, float] = {}

        def get(self, key: str, default=None):
            return self.data.get(key, default)

        def set(self, key: str, value: float, timeout: int | None = None) -> None:
            self.data[key] = value

    call_count = 0

    def fake_urlopen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise HTTPError(
            url="https://openrouter.ai/api/v1/chat/completions",
            code=429,
            msg="Too Many Requests",
            hdrs=None,
            fp=None,
        )

    monkeypatch.setattr("articles.workflow_engine.cache", FakeCache())
    monkeypatch.setattr("articles.workflow_engine.urlopen", fake_urlopen)
    monkeypatch.setattr("articles.workflow_engine.time.time", lambda: 1000.0)

    first_provider = AgentProvider()
    first_provider.api_key = "test-key"
    first_provider.rate_limit_cooldown_seconds = 60
    first_output = first_provider.author(["Transit expansion approved"], revision_round=0, feedback="")

    second_provider = AgentProvider()
    second_provider.api_key = "test-key"
    second_provider.rate_limit_cooldown_seconds = 60
    second_output = second_provider.author(["Transit expansion approved"], revision_round=0, feedback="")

    assert call_count == 1
    assert first_output["draft"]
    assert second_output["draft"]
