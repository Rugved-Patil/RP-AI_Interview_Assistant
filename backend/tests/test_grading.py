"""Tests for the grading route and its reply parser."""

import pytest

from app.api.routes.grading import GradeParseError, _parse_grade
from app.services.llm import LLMProviderError, Role

# --- _parse_grade: the reply parser, no HTTP involved -----------------------


@pytest.mark.parametrize(
    ("reply", "expected"),
    [
        ("SCORE: 7\nFEEDBACK: Solid answer.", (7, "Solid answer.")),
        ("**SCORE:** 8\n**FEEDBACK:** Good structure.", (8, "Good structure.")),
        ("**SCORE**: 9\n**FEEDBACK**: Strong.", (9, "Strong.")),
        ("**SCORE: 6**\n**FEEDBACK: Needs examples.**", (6, "Needs examples.")),
        ("score: 5\nfeedback: Too vague.", (5, "Too vague.")),
        ("SCORE: 7/10\nFEEDBACK: Fine.", (7, "Fine.")),
        ("Sure! Here you go.\nSCORE: 3\nFEEDBACK: Off topic.", (3, "Off topic.")),
        # A genuine 0 must parse - it's a real grade, unlike the old fallback 0.
        ("SCORE: 0\nFEEDBACK: Nothing relevant.", (0, "Nothing relevant.")),
    ],
)
def test_parse_grade_accepts_common_reply_shapes(reply, expected):
    assert _parse_grade(reply) == expected


def test_parse_grade_keeps_multiline_feedback():
    assert _parse_grade("SCORE: 4\nFEEDBACK: Line one.\nLine two.") == (4, "Line one.\nLine two.")


def test_parse_grade_clamps_out_of_range_scores():
    assert _parse_grade("SCORE: 15\nFEEDBACK: Too generous.")[0] == 10


@pytest.mark.parametrize(
    "reply",
    [
        "",
        "Great answer!",
        "FEEDBACK: Looks fine.",  # feedback but no score
        "SCORE: 8",  # score but no feedback
        "SCORE: 8\nFEEDBACK:",  # label with nothing after it
        "SCORE: 8\nFEEDBACK:   ",  # label with only whitespace
        "SCORE: 8\nFEEDBACK: **",  # only leftover markdown
    ],
)
def test_parse_grade_rejects_replies_missing_score_or_feedback(reply):
    with pytest.raises(GradeParseError):
        _parse_grade(reply)


# --- POST /sessions/{id}/grade ------------------------------------------------


def _submit_answer(client, session_id: str, text: str = "My answer.") -> None:
    response = client.post(f"/sessions/{session_id}/answer", json={"answer": text})
    assert response.status_code == 200, response.text


def test_grade_returns_score_and_feedback(client, providers, start_session):
    providers.grader.reply = "SCORE: 7\nFEEDBACK: Solid answer."
    session_id = start_session()
    _submit_answer(client, session_id)

    response = client.post(f"/sessions/{session_id}/grade")

    assert response.status_code == 200
    assert response.json() == {"session_id": session_id, "score": 7, "feedback": "Solid answer."}


def test_grader_prompt_carries_role_company_location_question_and_answer(client, providers, start_session):
    session_id = start_session(role="Data Scientist", company="Acme", location="Berlin")
    _submit_answer(client, session_id, "Bias-variance tradeoff explanation.")

    client.post(f"/sessions/{session_id}/grade")

    system_message, user_message = providers.grader.calls[0]
    assert system_message.role is Role.SYSTEM
    for expected in ("Data Scientist", "Acme", "Berlin"):
        assert expected in system_message.content
    # The question is whatever the (fake) interviewer generated.
    assert providers.interviewer.reply in user_message.content
    assert "Bias-variance tradeoff explanation." in user_message.content


def test_grading_an_unknown_session_is_a_404(client, providers):
    assert client.post("/sessions/does-not-exist/grade").status_code == 404


def test_grading_before_an_answer_is_submitted_is_a_400(client, start_session):
    session_id = start_session()

    assert client.post(f"/sessions/{session_id}/grade").status_code == 400


@pytest.mark.parametrize(
    "bad_reply",
    [
        "",
        "   \n",
        "Great answer, well done!",
        "SCORE: 8",
        "FEEDBACK: no score anywhere",
    ],
)
def test_unusable_grader_reply_is_a_502_and_leaves_the_session_ungraded(
    client, providers, start_session, bad_reply
):
    providers.grader.reply = bad_reply
    session_id = start_session()
    _submit_answer(client, session_id)

    assert client.post(f"/sessions/{session_id}/grade").status_code == 502
    # The point of the 502 (vs. the old fake 0): nothing bad can be saved.
    assert client.post(f"/sessions/{session_id}/save").status_code == 400


def test_grader_provider_failure_is_a_502(client, providers, start_session):
    providers.grader.error = LLMProviderError("boom", provider="fake")
    session_id = start_session()
    _submit_answer(client, session_id)

    response = client.post(f"/sessions/{session_id}/grade")

    assert response.status_code == 502
    assert "Grader provider failed" in response.json()["detail"]


def test_a_failed_grade_can_be_retried_and_then_saved(client, providers, start_session):
    # This is the flow the frontend's "Retry grading" button relies on.
    session_id = start_session()
    _submit_answer(client, session_id)

    providers.grader.reply = "not the requested format"
    assert client.post(f"/sessions/{session_id}/grade").status_code == 502

    providers.grader.reply = "SCORE: 6\nFEEDBACK: Decent."
    retry = client.post(f"/sessions/{session_id}/grade")
    assert retry.status_code == 200
    assert retry.json()["score"] == 6

    assert client.post(f"/sessions/{session_id}/save").status_code == 200