from rest_framework import serializers

from .models import AgentComment, AgentExecution, Article, LogEntry, WorkflowRun


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


class WorkflowStartSerializer(serializers.Serializer):
    bullet_points = serializers.ListField(
        child=serializers.CharField(allow_blank=False, max_length=1000),
        min_length=1,
    )

    def validate_bullet_points(self, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise serializers.ValidationError("Provide at least one non-empty bullet point.")
        return cleaned


class LogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LogEntry
        fields = ["id", "timestamp", "source", "message", "type"]


class AgentExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentExecution
        fields = ["id", "agent_name", "input", "output", "status", "created_at"]


class WorkflowRunSerializer(serializers.ModelSerializer):
    agents = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowRun
        fields = [
            "id",
            "status",
            "current_step",
            "data",
            "agents",
            "created_at",
        ]

    def get_agents(self, obj: WorkflowRun) -> list[dict[str, str]]:
        execution_map: dict[str, list[AgentExecution]] = {}
        for execution in obj.executions.all():
            execution_map.setdefault(execution.agent_name, []).append(execution)

        ordered_agents = [
            (AgentExecution.AgentName.AUTHOR, "Author"),
            (AgentExecution.AgentName.EDITOR, "Editor"),
            (AgentExecution.AgentName.FACT_CHECKER, "FactChecker"),
            (AgentExecution.AgentName.COPY_EDITOR, "CopyEditor"),
        ]

        output: list[dict[str, str]] = []
        for agent_key, label in ordered_agents:
            executions = execution_map.get(agent_key, [])
            status = "idle"
            if any(execution.status == AgentExecution.Status.FAILED for execution in executions):
                status = "failed"
            elif obj.status == WorkflowRun.Status.RUNNING and obj.current_step == agent_key:
                status = "running"
            elif any(execution.status == AgentExecution.Status.COMPLETED for execution in executions):
                status = "completed"

            output.append({"name": label, "status": status})

        return output
