"""
Integration tests for /questions API endpoints.
"""

from fastapi.testclient import TestClient
import pytest


def test_list_questions_endpoint(client: TestClient):
    response = client.get("/questions")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] > 0
    assert len(data["items"]) > 0


def test_list_questions_with_category_and_domain_filters(client: TestClient):
    response = client.get("/questions?category=behavioral")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["category"] == "behavioral"

    response_tech = client.get("/questions?domain=Frontend")
    assert response_tech.status_code == 200
    data_tech = response_tech.json()
    for item in data_tech["items"]:
        assert item["domain"] == "Frontend"


def test_list_questions_with_search_query(client: TestClient):
    response = client.get("/questions?search=virtual+dom")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    assert any("react" in item["tags"] or "frontend" in item["tags"] for item in data["items"])


def test_get_domains_stats_endpoint(client: TestClient):
    response = client.get("/questions/domains")
    assert response.status_code == 200
    data = response.json()
    assert data["total_questions"] > 0
    assert len(data["domains"]) > 0
    assert len(data["tags"]) > 0
    assert "technical" in data["categories"]


def test_get_question_by_id_success_and_not_found(client: TestClient):
    # Valid question
    response = client.get("/questions/be-003")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "be-003"
    assert "idempotent" in data["question"].lower()

    # Invalid question
    not_found = client.get("/questions/nonexistent-id-12345")
    assert not_found.status_code == 404


def test_post_rag_search_endpoint(client: TestClient):
    payload = {
        "query": "rate limiting and token bucket algorithm",
        "category": "technical",
        "role": "Backend Engineer",
        "top_k": 3,
    }
    response = client.post("/questions/search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == payload["query"]
    assert data["total_found"] > 0
    assert len(data["retrieved_questions"]) <= 3
    assert data["grounding_snippet"] is not None
    assert "Relevant exemplar interview questions" in data["grounding_snippet"]
