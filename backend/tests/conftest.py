"""
Shared pytest fixtures for the API-level tests.

Two things every route test needs that the LLM-wrapper tests didn't:
  1. A database that is NOT your real interview_reports.db.
  2. LLM providers that never touch the network (or your API quota).
"""

from __future__ import annotations

import os

# MUST run before anything imports app.*: app.db.base builds its engine from
# settings at import time, and app.main calls init_db() at import time.
# Forcing an in-memory URL here means importing the app in tests can never
# create or touch the real interview_reports.db. (Env vars override .env.)
os.environ["DATABASE_URL"] = "sqlite://"

# The imports below are deliberately after the line above.
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import models  # noqa: F401  (registers the tables on Base)
from app.db.base import Base, get_db
from app.main import app
from app.services import session_store
from app.services.llm import LLMProvider, LLMResponse, LLMRole, Message


class FakeProvider(LLMProvider):
    """
    Stands in for GroqProvider / GeminiProvider.

    Set `.reply` to control what the "model" says, or `.error` to make it
    fail. `.calls` records every message list it was sent, so tests can
    assert on the prompts the routes build.
    """

    def __init__(self, reply: str = "") -> None:
        self.reply = reply
        self.error: Exception | None = None
        self.calls: list[list[Message]] = []

    async def generate(
        self,
        messages: list[Message],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        self.calls.append(messages)
        if self.error is not None:
            raise self.error
        return LLMResponse(text=self.reply, provider="fake", model="fake")


@pytest.fixture(autouse=True)
def _clean_session_store():
    # The in-progress session store is a module-level dict; empty it around
    # every test so no test can see another test's sessions.
    session_store._sessions.clear()
    yield
    session_store._sessions.clear()


@pytest.fixture
def client():
    # StaticPool + check_same_thread=False makes every connection share ONE
    # in-memory database. Without it, each thread would get its own empty
    # database, and TestClient serves requests on a different thread than
    # the one that created the tables.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def providers(monkeypatch):
    """Replaces get_provider in the routes with fakes; returns them for tests to steer."""
    interviewer = FakeProvider(reply="Explain overfitting.")
    grader = FakeProvider(reply="SCORE: 7\nFEEDBACK: Solid answer.")

    def fake_get_provider(role: LLMRole) -> LLMProvider:
        return interviewer if role is LLMRole.INTERVIEWER else grader

    # Patched where the routes *use* it, not where it's defined - each route
    # module did `from app.services.llm import get_provider`, so each holds
    # its own reference.
    monkeypatch.setattr("app.api.routes.sessions.get_provider", fake_get_provider)
    monkeypatch.setattr("app.api.routes.grading.get_provider", fake_get_provider)
    return SimpleNamespace(interviewer=interviewer, grader=grader)


@pytest.fixture
def start_session(client, providers):
    """Returns a function that opens a practice session and hands back its id."""

    def _start(role: str = "ML Engineer", **extra: str) -> str:
        response = client.post("/sessions/situational", json={"role": role, **extra})
        assert response.status_code == 200, response.text
        return response.json()["session_id"]

    return _start


@pytest.fixture
def graded_session(client, start_session) -> str:
    """A session that has been opened, answered and successfully graded."""
    session_id = start_session()
    client.post(f"/sessions/{session_id}/answer", json={"answer": "My answer."})
    response = client.post(f"/sessions/{session_id}/grade")
    assert response.status_code == 200, response.text
    return session_id