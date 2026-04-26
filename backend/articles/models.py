from django.db import models


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
