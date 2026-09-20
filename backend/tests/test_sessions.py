"""Tests for the situational-practice session routes (sessions.py)."""

import pytest

from app.schemas.session import MAX_ANSWER_LENGTH
from app.services import session_store
from app.services.llm import LLMProviderError, Role

# --- POST /sessions/situational ---------------------------------------------


def test_start_returns_a_session_id_and_the_stripped_question(client, providers):
    providers.interviewer.reply = "  Explain the bias-variance tradeoff.\n"

    response = client.post("/sessions/situational", json={"role": "ML Engineer"})

    assert response.status_code == 200
    body = response.json()
    assert body["question"] == "Explain the bias-variance tradeoff."
    assert session_store.get_session(body["session_id"]) is not None


def test_interviewer_is_called_once_with_a_system_prompt_naming_the_role(client, providers):
    client.post("/sessions/situational", json={"role": "ML Engineer"})

    assert len(providers.interviewer.calls) == 1
    (message,) = providers.interviewer.calls[0]
    assert message.role is Role.SYSTEM
    assert "ML Engineer" in message.content


def test_session_remembers_the_personalization_it_was_created_with(start_session):
    # Grading later reads these back off the session (see test_grading.py).
    session_id = start_session(role="Data Scientist", company="Acme", location="Berlin")

    session = session_store.get_session(session_id)
    assert (session.role, session.company, session.location) == ("Data Scientist", "Acme", "Berlin")


def test_role_is_trimmed_and_blank_optionals_become_none(client, providers):
    response = client.post(
        "/sessions/situational",
        json={"role": "  ML Engineer  ", "company": "", "location": "   "},
    )

    assert response.status_code == 200
    session = session_store.get_session(response.json()["session_id"])
    assert session.role == "ML Engineer"
    assert session.company is None
    assert session.location is None


@pytest.mark.parametrize(
    "body",
    [{}, {"role": ""}, {"role": "   "}, {"role": None}],
)
def test_a_missing_or_blank_role_is_rejected_before_any_llm_call(client, providers, body):
    response = client.post("/sessions/situational", json=body)

    assert response.status_code == 422
    # An invalid request must not burn free-tier quota.
    assert providers.interviewer.calls == []


def test_interviewer_failure_is_a_502_and_creates_no_session(client, providers):
    providers.interviewer.error = LLMProviderError("boom", provider="fake")

    response = client.post("/sessions/situational", json={"role": "ML Engineer"})

    assert response.status_code == 502
    assert "Interviewer provider failed" in response.json()["detail"]
    assert session_store._sessions == {}


@pytest.mark.parametrize("reply", ["", "   \n"])
def test_an_empty_question_is_a_502_and_creates_no_session(client, providers, reply):
    providers.interviewer.reply = reply

    response = client.post("/sessions/situational", json={"role": "ML Engineer"})

    assert response.status_code == 502
    assert session_store._sessions == {}


# --- POST /sessions/{id}/answer ---------------------------------------------


def test_submitting_an_answer_stores_it_on_the_session(client, start_session):
    session_id = start_session()

    response = client.post(f"/sessions/{session_id}/answer", json={"answer": "My answer."})

    assert response.status_code == 200
    assert response.json() == {"session_id": session_id, "status": "answer_recorded"}
    assert session_store.get_session(session_id).answer == "My answer."


def test_resubmitting_replaces_the_previous_answer(client, start_session):
    # The frontend's "Retry grading" re-sends the answer, possibly edited.
    session_id = start_session()

    client.post(f"/sessions/{session_id}/answer", json={"answer": "First try."})
    client.post(f"/sessions/{session_id}/answer", json={"answer": "Second try."})

    assert session_store.get_session(session_id).answer == "Second try."


def test_answering_an_unknown_session_is_a_404(client):
    response = client.post("/sessions/does-not-exist/answer", json={"answer": "x"})

    assert response.status_code == 404


def test_an_answer_body_is_required(client, start_session):
    session_id = start_session()

    assert client.post(f"/sessions/{session_id}/answer", json={}).status_code == 422


def test_the_stored_answer_is_trimmed(client, start_session):
    session_id = start_session()

    client.post(f"/sessions/{session_id}/answer", json={"answer": "  My answer.\n"})

    assert session_store.get_session(session_id).answer == "My answer."


@pytest.mark.parametrize("answer", ["", "   ", "\n\t  \n"])
def test_a_blank_answer_is_rejected(client, start_session, answer):
    session_id = start_session()

    response = client.post(f"/sessions/{session_id}/answer", json={"answer": answer})

    assert response.status_code == 422
    assert session_store.get_session(session_id).answer is None


def test_a_rejected_answer_does_not_overwrite_the_previous_one(client, start_session):
    # A bad retry must not wipe out the last good answer.
    session_id = start_session()
    client.post(f"/sessions/{session_id}/answer", json={"answer": "First try."})

    response = client.post(f"/sessions/{session_id}/answer", json={"answer": "   "})

    assert response.status_code == 422
    assert session_store.get_session(session_id).answer == "First try."


def test_an_answer_at_the_length_limit_is_accepted(client, start_session):
    session_id = start_session()
    answer = "a" * MAX_ANSWER_LENGTH

    response = client.post(f"/sessions/{session_id}/answer", json={"answer": answer})

    assert response.status_code == 200
    assert session_store.get_session(session_id).answer == answer


def test_an_answer_over_the_length_limit_is_rejected(client, start_session):
    session_id = start_session()

    response = client.post(
        f"/sessions/{session_id}/answer", json={"answer": "a" * (MAX_ANSWER_LENGTH + 1)}
    )

    assert response.status_code == 422
    assert session_store.get_session(session_id).answer is None


def test_padding_whitespace_does_not_count_towards_the_length_limit(client, start_session):
    # Trimming happens before the length check, so a limit-sized answer with
    # trailing whitespace is still accepted.
    session_id = start_session()
    answer = "a" * MAX_ANSWER_LENGTH

    response = client.post(f"/sessions/{session_id}/answer", json={"answer": f"{answer}   \n"})

    assert response.status_code == 200
    assert session_store.get_session(session_id).answer == answer