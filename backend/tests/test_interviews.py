"""Tests for the mock interview setup endpoint (interviews.py)."""

import pytest

from app.services import interview_store
from app.services.interview_store import InterviewStatus
from app.services.llm import LLMProviderError, Role


# --- POST /interviews/start --------------------------------------------------


def test_start_returns_session_id_and_first_question(client, providers):
    providers.interviewer.reply = "Tell me about your background in machine learning."

    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    assert response.status_code == 200
    body = response.json()
    assert "session_id" in body
    assert body["first_question"] == "Tell me about your background in machine learning."


def test_opening_question_is_trimmed(client, providers):
    providers.interviewer.reply = "  What is your experience?  \n"

    response = client.post("/interviews/start", json={
        "interview_type": "hr",
        "experience_level": "junior",
        "role": "Software Engineer",
    })

    assert response.status_code == 200
    assert response.json()["first_question"] == "What is your experience?"


def test_session_stores_all_configuration(client, providers):
    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "senior",
        "role": "Data Scientist",
        "company": "Acme",
        "location": "Berlin",
    })

    session = interview_store.get_interview(response.json()["session_id"])
    assert session.interview_type.value == "technical"
    assert session.experience_level.value == "senior"
    assert session.role == "Data Scientist"
    assert session.company == "Acme"
    assert session.location == "Berlin"


def test_opening_question_is_recorded_in_transcript(client, providers):
    providers.interviewer.reply = "Tell me about yourself."

    response = client.post("/interviews/start", json={
        "interview_type": "hr",
        "experience_level": "mid",
        "role": "PM",
    })

    session = interview_store.get_interview(response.json()["session_id"])
    assert len(session.transcript) == 1
    assert session.transcript[0].role == "interviewer"
    assert session.transcript[0].content == "Tell me about yourself."


def test_new_session_status_is_in_progress(client, providers):
    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    session = interview_store.get_interview(response.json()["session_id"])
    assert session.status is InterviewStatus.IN_PROGRESS


def test_system_prompt_is_stored_on_session(client, providers):
    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    session = interview_store.get_interview(response.json()["session_id"])
    assert session.system_prompt  # non-empty
    assert "ML Engineer" in session.system_prompt


def test_interviewer_receives_system_prompt_with_all_context(client, providers):
    client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "senior",
        "role": "ML Engineer",
        "company": "Acme",
        "location": "Berlin",
    })

    assert len(providers.interviewer.calls) == 1
    (message,) = providers.interviewer.calls[0]
    assert message.role is Role.SYSTEM
    for expected in ("ML Engineer", "Acme", "Berlin", "senior"):
        assert expected in message.content


def test_role_is_trimmed_and_blank_optionals_become_none(client, providers):
    response = client.post("/interviews/start", json={
        "interview_type": "hr",
        "experience_level": "junior",
        "role": "  ML Engineer  ",
        "company": "",
        "location": "   ",
    })

    assert response.status_code == 200
    session = interview_store.get_interview(response.json()["session_id"])
    assert session.role == "ML Engineer"
    assert session.company is None
    assert session.location is None


# --- validation ---------------------------------------------------------------


@pytest.mark.parametrize("body", [
    {"interview_type": "technical", "experience_level": "mid"},
    {"interview_type": "technical", "experience_level": "mid", "role": ""},
    {"interview_type": "technical", "experience_level": "mid", "role": "   "},
])
def test_missing_or_blank_role_is_rejected(client, providers, body):
    response = client.post("/interviews/start", json=body)

    assert response.status_code == 422
    assert providers.interviewer.calls == []


@pytest.mark.parametrize("bad_type", ["behavioral", "mixed", ""])
def test_invalid_interview_type_is_rejected(client, providers, bad_type):
    response = client.post("/interviews/start", json={
        "interview_type": bad_type,
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    assert response.status_code == 422
    assert providers.interviewer.calls == []


@pytest.mark.parametrize("bad_level", ["intern", "principal", ""])
def test_invalid_experience_level_is_rejected(client, providers, bad_level):
    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": bad_level,
        "role": "ML Engineer",
    })

    assert response.status_code == 422
    assert providers.interviewer.calls == []


def test_missing_interview_type_is_rejected(client, providers):
    response = client.post("/interviews/start", json={
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    assert response.status_code == 422


def test_missing_experience_level_is_rejected(client, providers):
    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "role": "ML Engineer",
    })

    assert response.status_code == 422


# --- error handling -----------------------------------------------------------


def test_interviewer_failure_is_a_502_and_creates_no_session(client, providers):
    providers.interviewer.error = LLMProviderError("boom", provider="fake")

    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    assert response.status_code == 502
    assert "Interviewer provider failed" in response.json()["detail"]
    assert interview_store._interviews == {}


@pytest.mark.parametrize("reply", ["", "   \n"])
def test_empty_question_is_a_502_and_creates_no_session(client, providers, reply):
    providers.interviewer.reply = reply

    response = client.post("/interviews/start", json={
        "interview_type": "technical",
        "experience_level": "mid",
        "role": "ML Engineer",
    })

    assert response.status_code == 502
    assert interview_store._interviews == {}
