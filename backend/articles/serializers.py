from rest_framework import serializers

from .models import AgentComment, Article


class AgentCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentComment
        fields = ["id", "agent", "body", "created_at"]
        read_only_fields = ["id", "created_at"]


class ArticleSerializer(serializers.ModelSerializer):
    comments = AgentCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = [
            "id",
            "title",
            "bullet_points",
            "content",
            "status",
            "comments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "comments"]
