import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Article


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
