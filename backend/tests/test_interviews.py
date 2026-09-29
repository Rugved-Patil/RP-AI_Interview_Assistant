"""Tests for the mock interview endpoints (interviews.py)."""

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


# --- start: validation -------------------------------------------------------


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


# --- start: error handling ----------------------------------------------------


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


# --- POST /interviews/{session_id}/answer ------------------------------------


def test_answer_returns_the_next_question(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "Can you explain decorators?"
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "I know about overfitting."}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["interviewer_message"] == "Can you explain decorators?"
    assert body["interview_ended"] is False
    assert body["turn_number"] == 1


def test_transcript_grows_with_each_turn(client, providers, start_interview):
    session_id = start_interview()  # Q1 = default fake reply

    providers.interviewer.reply = "Question 2?"
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Answer 1."})

    providers.interviewer.reply = "Question 3?"
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Answer 2."})

    session = interview_store.get_interview(session_id)
    # Q1, A1, Q2, A2, Q3 = 5 entries
    assert len(session.transcript) == 5
    roles = [t.role for t in session.transcript]
    assert roles == ["interviewer", "candidate", "interviewer", "candidate", "interviewer"]


def test_turn_number_increments(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "Q2?"
    r1 = client.post(f"/interviews/{session_id}/answer", json={"answer": "A1."})
    assert r1.json()["turn_number"] == 1

    providers.interviewer.reply = "Q3?"
    r2 = client.post(f"/interviews/{session_id}/answer", json={"answer": "A2."})
    assert r2.json()["turn_number"] == 2


def test_full_transcript_is_sent_to_groq(client, providers, start_interview):
    session_id = start_interview()  # Q1 = "Explain overfitting." (default fake reply)

    providers.interviewer.reply = "Follow-up question?"
    client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer about overfitting."}
    )

    # The second call to the interviewer (first was for start).
    assert len(providers.interviewer.calls) == 2
    messages = providers.interviewer.calls[1]

    # Should be: system prompt, Q1 (assistant), A1 (user)
    assert len(messages) == 3
    assert messages[0].role is Role.SYSTEM
    assert messages[1].role is Role.ASSISTANT
    assert messages[1].content == "Explain overfitting."
    assert messages[2].role is Role.USER
    assert messages[2].content == "My answer about overfitting."


# --- turn loop: ending --------------------------------------------------------


def test_end_signal_ends_the_interview(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "Thank you for your time.\n[END_INTERVIEW]"
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    )

    body = response.json()
    assert body["interview_ended"] is True
    assert body["interviewer_message"] == "Thank you for your time."

    session = interview_store.get_interview(session_id)
    assert session.status is InterviewStatus.COMPLETED


def test_end_signal_without_closing_remark(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "[END_INTERVIEW]"
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    )

    body = response.json()
    assert body["interview_ended"] is True
    assert body["interviewer_message"] is None


def test_closing_remark_is_recorded_in_transcript(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "Thanks, that's all.\n[END_INTERVIEW]"
    client.post(f"/interviews/{session_id}/answer", json={"answer": "My answer."})

    session = interview_store.get_interview(session_id)
    # Q1, A1, closing remark = 3 entries
    assert len(session.transcript) == 3
    assert session.transcript[2].role == "interviewer"
    assert session.transcript[2].content == "Thanks, that's all."


def test_hard_cap_ends_interview_without_groq_call(
    client, providers, start_interview, monkeypatch
):
    monkeypatch.setattr("app.api.routes.interviews.MAX_QUESTIONS", 2)
    session_id = start_interview()  # Q1 asked (1 interviewer turn)

    # Answer Q1 → model asks Q2 (still under cap after Q1)
    providers.interviewer.reply = "Question 2?"
    r1 = client.post(f"/interviews/{session_id}/answer", json={"answer": "Answer 1."})
    assert r1.json()["interview_ended"] is False

    # Answer Q2 → hard cap reached (2 questions asked), no Groq call
    r2 = client.post(f"/interviews/{session_id}/answer", json={"answer": "Answer 2."})
    assert r2.json()["interview_ended"] is True
    assert r2.json()["interviewer_message"] is None
    assert r2.json()["turn_number"] == 2

    # Groq was called twice: once for Q1 (start), once for Q2 (first answer).
    # The second answer did NOT trigger a third call.
    assert len(providers.interviewer.calls) == 2

    session = interview_store.get_interview(session_id)
    assert session.status is InterviewStatus.COMPLETED


# --- turn loop: validation ----------------------------------------------------


def test_answering_a_completed_interview_is_409(client, providers, start_interview):
    session_id = start_interview()

    providers.interviewer.reply = "Thanks!\n[END_INTERVIEW]"
    client.post(f"/interviews/{session_id}/answer", json={"answer": "My answer."})

    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "Another answer."}
    )
    assert response.status_code == 409


def test_answering_an_unknown_interview_is_404(client, providers):
    response = client.post(
        "/interviews/does-not-exist/answer", json={"answer": "x"}
    )
    assert response.status_code == 404


def test_an_answer_body_is_required(client, start_interview):
    session_id = start_interview()
    assert client.post(f"/interviews/{session_id}/answer", json={}).status_code == 422


@pytest.mark.parametrize("answer", ["", "   ", "\n\t  \n"])
def test_a_blank_answer_is_rejected(client, start_interview, answer):
    session_id = start_interview()

    response = client.post(f"/interviews/{session_id}/answer", json={"answer": answer})

    assert response.status_code == 422
    # Transcript should still have only the opening question.
    session = interview_store.get_interview(session_id)
    assert len(session.transcript) == 1


# --- turn loop: error handling ------------------------------------------------


def test_groq_failure_rolls_back_the_answer(client, providers, start_interview):
    session_id = start_interview()  # transcript: [Q1]

    providers.interviewer.error = LLMProviderError("boom", provider="fake")
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    )

    assert response.status_code == 502
    # The answer was rolled back — transcript still has only Q1.
    session = interview_store.get_interview(session_id)
    assert len(session.transcript) == 1
    assert session.status is InterviewStatus.IN_PROGRESS


def test_rolled_back_answer_can_be_retried(client, providers, start_interview):
    session_id = start_interview()

    # First attempt fails.
    providers.interviewer.error = LLMProviderError("boom", provider="fake")
    assert client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    ).status_code == 502

    # Retry succeeds.
    providers.interviewer.error = None
    providers.interviewer.reply = "Follow-up?"
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    )

    assert response.status_code == 200
    assert response.json()["interviewer_message"] == "Follow-up?"


@pytest.mark.parametrize("reply", ["", "   \n"])
def test_empty_reply_is_a_502_and_rolls_back(client, providers, start_interview, reply):
    session_id = start_interview()

    providers.interviewer.reply = reply
    response = client.post(
        f"/interviews/{session_id}/answer", json={"answer": "My answer."}
    )

    assert response.status_code == 502
    session = interview_store.get_interview(session_id)
    assert len(session.transcript) == 1
    assert session.status is InterviewStatus.IN_PROGRESS


# --- POST /interviews/{session_id}/end ---------------------------------------


def test_end_interview_marks_status_completed(client, providers, start_interview):
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/answer", json={"answer": "My answer."})

    response = client.post(f"/interviews/{session_id}/end")
    assert response.status_code == 200
    assert response.json() == {"session_id": session_id, "status": "completed"}

    session = interview_store.get_interview(session_id)
    assert session.status is InterviewStatus.COMPLETED


def test_ending_unknown_interview_is_a_404(client):
    assert client.post("/interviews/unknown-id/end").status_code == 404


def test_ending_already_completed_interview_is_idempotent(client, providers, start_interview):
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/end")
    response = client.post(f"/interviews/{session_id}/end")
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


# --- POST /interviews/{session_id}/grade -------------------------------------


def test_grade_interview_returns_score_and_feedback(client, providers, start_interview):
    providers.grader.reply = "SCORE: 8\nFEEDBACK: Strong domain knowledge and clear communication."
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/answer", json={"answer": "First detailed answer."})

    response = client.post(f"/interviews/{session_id}/grade")
    assert response.status_code == 200
    assert response.json() == {
        "session_id": session_id,
        "score": 8,
        "feedback": "Strong domain knowledge and clear communication.",
    }

    session = interview_store.get_interview(session_id)
    assert session.score == 8
    assert session.feedback == "Strong domain knowledge and clear communication."
    assert session.status is InterviewStatus.GRADED


def test_grader_receives_full_transcript_and_context(client, providers, start_interview):
    session_id = start_interview(
        interview_type="technical",
        experience_level="senior",
        role="Data Scientist",
        company="Acme",
        location="Berlin",
    )
    providers.interviewer.reply = "Follow-up on transformers?"
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Answer about attention."})

    client.post(f"/interviews/{session_id}/grade")

    assert len(providers.grader.calls) == 1
    system_message, user_message = providers.grader.calls[0]
    assert system_message.role is Role.SYSTEM
    for expected in ("Data Scientist", "Acme", "Berlin", "senior"):
        assert expected in system_message.content

    assert user_message.role is Role.USER
    assert "Interviewer:" in user_message.content
    assert "Candidate: Answer about attention." in user_message.content


def test_grading_without_answers_is_a_400(client, providers, start_interview):
    session_id = start_interview()
    response = client.post(f"/interviews/{session_id}/grade")
    assert response.status_code == 400
    assert "no answers submitted" in response.json()["detail"]


def test_grading_unknown_interview_is_a_404(client):
    assert client.post("/interviews/unknown-id/grade").status_code == 404


@pytest.mark.parametrize(
    "bad_reply",
    [
        "",
        "   \n",
        "Great interview!",
        "SCORE: 8",
        "FEEDBACK: missing score",
    ],
)
def test_unusable_grader_reply_is_a_502_and_leaves_session_ungraded(
    client, providers, start_interview, bad_reply
):
    providers.grader.reply = bad_reply
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Candidate answer."})

    response = client.post(f"/interviews/{session_id}/grade")
    assert response.status_code == 502

    session = interview_store.get_interview(session_id)
    assert session.score is None
    assert session.feedback is None
    assert session.status is not InterviewStatus.GRADED


def test_grader_failure_is_a_502(client, providers, start_interview):
    providers.grader.error = LLMProviderError("Gemini error", provider="fake")
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Candidate answer."})

    response = client.post(f"/interviews/{session_id}/grade")
    assert response.status_code == 502
    assert "Grader provider failed" in response.json()["detail"]


def test_failed_interview_grade_can_be_retried(client, providers, start_interview):
    session_id = start_interview()
    client.post(f"/interviews/{session_id}/answer", json={"answer": "Candidate answer."})

    providers.grader.reply = "Invalid format"
    assert client.post(f"/interviews/{session_id}/grade").status_code == 502

    providers.grader.reply = "SCORE: 9\nFEEDBACK: Excellent explanation."
    retry = client.post(f"/interviews/{session_id}/grade")
    assert retry.status_code == 200
    assert retry.json()["score"] == 9

    session = interview_store.get_interview(session_id)
    assert session.score == 9
    assert session.status is InterviewStatus.GRADED


