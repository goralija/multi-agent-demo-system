import uuid

from django.db import models


def default_workflow_data() -> dict[str, object]:
    return {"draft": "", "flags": [], "final_article": ""}


class Article(models.Model):
    """A draft/poliran article processed by the agent pipeline."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        EDITING = "editing", "Editing"
        FACT_CHECKING = "fact_checking", "Fact-checking"
        COPY_EDITING = "copy_editing", "Copy editing"
        DONE = "done", "Done"

    title = models.CharField(max_length=255)
    bullet_points = models.TextField(help_text="Newline-separated bullet points input.")
    content = models.TextField(blank=True, default="")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class AgentComment(models.Model):
    """A comment left on an article by one of the pipeline agents."""

    class Agent(models.TextChoices):
        AUTHOR = "author", "Author"
        EDITOR = "editor", "Editor"
        FACT_CHECKER = "fact_checker", "Fact-checker"
        COPY_EDITOR = "copy_editor", "Copy editor"

    article = models.ForeignKey(Article, related_name="comments", on_delete=models.CASCADE)
    agent = models.CharField(max_length=32, choices=Agent.choices)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.agent} on {self.article_id}"


class WorkflowRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Step(models.TextChoices):
        AUTHOR = "author", "Author"
        EDITOR = "editor", "Editor"
        FACT_CHECKER = "fact_checker", "Fact-checker"
        COPY_EDITOR = "copy_editor", "Copy editor"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    current_step = models.CharField(max_length=32, choices=Step.choices, default=Step.AUTHOR)
    bullet_points = models.JSONField(default=list)
    data = models.JSONField(default=default_workflow_data)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"workflow {self.pk} ({self.status})"


class AgentExecution(models.Model):
    class AgentName(models.TextChoices):
        AUTHOR = "author", "Author"
        EDITOR = "editor", "Editor"
        FACT_CHECKER = "fact_checker", "Fact-checker"
        COPY_EDITOR = "copy_editor", "Copy editor"

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    workflow = models.ForeignKey(WorkflowRun, related_name="executions", on_delete=models.CASCADE)
    agent_name = models.CharField(max_length=32, choices=AgentName.choices)
    input = models.JSONField(default=dict)
    output = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.agent_name} ({self.status}) on {self.workflow_id}"


class LogEntry(models.Model):
    class Type(models.TextChoices):
        INFO = "info", "Info"
        ACTION = "action", "Action"
        ERROR = "error", "Error"

    workflow = models.ForeignKey(WorkflowRun, related_name="logs", on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=64)
    message = models.TextField()
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.INFO)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self) -> str:
        return f"{self.source}: {self.message[:48]}"
