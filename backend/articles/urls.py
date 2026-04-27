from rest_framework.routers import DefaultRouter

from .views import ArticleViewSet, WorkflowRunViewSet

router = DefaultRouter()
router.register(r"articles", ArticleViewSet, basename="article")
router.register(r"workflows", WorkflowRunViewSet, basename="workflow")

urlpatterns = router.urls
