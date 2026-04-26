from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AgentComment, Article
from .serializers import AgentCommentSerializer, ArticleSerializer


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
