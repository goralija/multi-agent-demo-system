from django.contrib import admin

from .models import AgentComment, Article


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "content")


@admin.register(AgentComment)
class AgentCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "article", "agent", "created_at")
    list_filter = ("agent",)
