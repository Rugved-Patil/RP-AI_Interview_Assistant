"""
Tests for settings, system diagnostics, and data export/import endpoints.
"""

from __future__ import annotations

import json
from fastapi.testclient import TestClient

from app.services.llm.base import LLMProvider, LLMResponse, Message


def test_get_settings_config(client: TestClient, providers, start_session) -> None:
    # Save a report
    sid = start_session(role="Backend Engineer")
    client.post(f"/sessions/{sid}/answer", json={"answer": "Indexing helps lookups."})
    client.post(f"/sessions/{sid}/grade")
    client.post(f"/sessions/{sid}/save")

    # Create a preset
    client.post("/presets", json={"role": "Frontend Dev", "company": "Vercel"})

    resp = client.get("/settings/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "app_name" in data
    assert "evaluator_configured" in data
    assert "interviewer_configured" in data
    assert data["total_single_reports"] >= 1
    assert data["total_presets"] >= 1


def test_export_data_json(client: TestClient, providers, start_session) -> None:
    sid = start_session(role="Database Admin")
    client.post(f"/sessions/{sid}/answer", json={"answer": "B-trees are balanced."})
    client.post(f"/sessions/{sid}/grade")
    client.post(f"/sessions/{sid}/save")

    client.post("/presets", json={"role": "SRE Engineer", "company": "Acme"})

    resp = client.get("/data/export?format=json")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == "1.0"
    assert "exported_at" in data
    assert any(x["session_id"] == sid for x in data["saved_reports"])
    assert any(x["role"] == "SRE Engineer" for x in data["presets"])


def test_export_data_csv(client: TestClient, providers, start_session) -> None:
    sid = start_session(role="QA Lead")
    client.post(f"/sessions/{sid}/answer", json={"answer": "Automation test suites."})
    client.post(f"/sessions/{sid}/grade")
    client.post(f"/sessions/{sid}/save")

    resp = client.get("/data/export?format=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Record Type,Session ID" in resp.text
    assert "QA Lead" in resp.text


def test_import_data(client: TestClient) -> None:
    payload = {
        "saved_reports": [
            {
                "session_id": "imported-s1",
                "question": "What is REST?",
                "answer": "Representational State Transfer",
                "score": 9,
                "feedback": "Clear explanation",
                "role": "API Engineer",
                "created_at": "2026-09-01T12:00:00Z",
            }
        ],
        "saved_interview_reports": [
            {
                "session_id": "imported-m1",
                "interview_type": "technical",
                "experience_level": "senior",
                "role": "Lead Architect",
                "score": 9,
                "feedback": "Top tier candidate",
                "transcript_json": json.dumps([{"role": "interviewer", "content": "Welcome"}]),
                "created_at": "2026-09-01T13:00:00Z",
            }
        ],
        "presets": [
            {
                "role": "Rust Engineer",
                "company": "FastTech",
                "location": "Remote",
            }
        ],
    }

    resp = client.post("/data/import", json=payload)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["imported_single_reports"] == 1
    assert res_data["imported_mock_reports"] == 1
    assert res_data["imported_presets"] == 1
    assert res_data["total_imported"] == 3

    # Check that they appear in list endpoints
    reports = client.get("/reports").json()
    assert any(r["session_id"] == "imported-s1" for r in reports)

    mock_reports = client.get("/interviews/reports").json()
    assert any(m["session_id"] == "imported-m1" for m in mock_reports)

    presets = client.get("/presets").json()
    assert any(p["role"] == "Rust Engineer" for p in presets)


def test_clear_data(client: TestClient, providers, start_session) -> None:
    sid = start_session(role="DevOps")
    client.post(f"/sessions/{sid}/answer", json={"answer": "CI/CD"})
    client.post(f"/sessions/{sid}/grade")
    client.post(f"/sessions/{sid}/save")

    client.post("/presets", json={"role": "DevOps"})

    resp = client.post(
        "/data/clear",
        json={"clear_single_reports": True, "clear_mock_reports": True, "clear_presets": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cleared_single_reports"] >= 1
    assert data["cleared_presets"] >= 1

    # Verify lists are empty
    assert client.get("/reports").json() == []
    assert client.get("/presets").json() == []


def test_verify_connections(client: TestClient, monkeypatch) -> None:
    class MockProvider(LLMProvider):
        async def generate(self, messages: list[Message], *, temperature: float = 0.7, max_tokens: int | None = None) -> LLMResponse:
            return LLMResponse(text="OK", provider="mock", model="mock-model")

    monkeypatch.setattr("app.api.routes.settings.get_provider", lambda role: MockProvider())
    monkeypatch.setattr("app.api.routes.settings.get_settings", lambda: type("Settings", (), {
        "gemini_api_key": "dummy-gemini-key",
        "groq_api_key": "dummy-groq-key",
        "gemini_model": "test-model",
        "groq_model": "test-model",
        "app_name": "Test App",
        "rag_enabled": True,
    })())

    resp = client.post("/settings/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["evaluator"]["ok"] is True
    assert data["interviewer"]["ok"] is True
    assert data["all_ok"] is True
