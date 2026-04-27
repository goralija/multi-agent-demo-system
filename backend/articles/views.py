from django.conf import settings
from django.db import transaction
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AgentComment, Article, WorkflowRun, default_workflow_data
from .serializers import (
    AgentCommentSerializer,
    ArticleSerializer,
    LogEntrySerializer,
    WorkflowRunSerializer,
    WorkflowStartSerializer,
)
from .workflow_engine import launch_workflow, run_workflow


class ArticleViewSet(viewsets.ModelViewSet):
    queryset = Article.objects.all().prefetch_related("comments")
    serializer_class = ArticleSerializer

    @action(detail=True, methods=["post"], url_path="comments")
    def add_comment(self, request, pk=None):
        article = self.get_object()
        serializer = AgentCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AgentComment.objects.create(article=article, **serializer.validated_data)
        return Response(serializer.data, status=201)


class WorkflowRunViewSet(viewsets.ModelViewSet):
    queryset = WorkflowRun.objects.all().prefetch_related("executions", "logs")
    serializer_class = WorkflowRunSerializer
    http_method_names = ["get", "post", "head", "options"]

    def create(self, request, *args, **kwargs):
        input_serializer = WorkflowStartSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        workflow = WorkflowRun.objects.create(
            status=WorkflowRun.Status.RUNNING,
            current_step=WorkflowRun.Step.AUTHOR,
            bullet_points=input_serializer.validated_data["bullet_points"],
            data=default_workflow_data(),
        )

        if getattr(settings, "WORKFLOW_SYNC_EXECUTION", False):
            run_workflow(str(workflow.id))
        else:
            transaction.on_commit(
                lambda workflow_id=str(workflow.id): launch_workflow(workflow_id)
            )

        workflow.refresh_from_db()
        serializer = self.get_serializer(workflow)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        workflow = self.get_object()
        serializer = LogEntrySerializer(workflow.logs.all(), many=True)
        return Response(serializer.data)
