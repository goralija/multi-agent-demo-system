from django.contrib import admin

from .models import AgentComment, AgentExecution, Article, LogEntry, WorkflowRun


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "content")


@admin.register(AgentComment)
class AgentCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "article", "agent", "created_at")
    list_filter = ("agent",)


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    list_display = ("id", "status", "current_step", "created_at")
    list_filter = ("status", "current_step")
    search_fields = ("id",)


@admin.register(AgentExecution)
class AgentExecutionAdmin(admin.ModelAdmin):
    list_display = ("id", "workflow", "agent_name", "status", "created_at")
    list_filter = ("agent_name", "status")
    search_fields = ("workflow__id",)


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "workflow", "timestamp", "source", "type")
    list_filter = ("type", "source")
    search_fields = ("workflow__id", "source", "message")
