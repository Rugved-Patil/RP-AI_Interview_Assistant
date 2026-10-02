"""
Invariants for the prompt builders - deliberately NOT their exact wording.

The scope doc (Section 7.2) says prompts will be tuned empirically, so
tests that pinned the wording would fail on every tweak and end up deleted.
These pin only what must stay true however the prompts get reworded.
"""

import pytest

from app.api.routes.grading import _build_grader_prompt
from app.api.routes.interviews import _build_mock_interviewer_prompt
from app.api.routes.sessions import _build_interviewer_prompt
from app.services.interview_store import ExperienceLevel, InterviewType

# --- shared: single-question interviewer + grader ----------------------------

SINGLE_Q_BUILDERS = [_build_interviewer_prompt, _build_grader_prompt]


@pytest.mark.parametrize("build", SINGLE_Q_BUILDERS)
def test_prompt_includes_every_supplied_detail(build):
    prompt = build("Data Scientist", "Acme", "Berlin")

    for expected in ("Data Scientist", "Acme", "Berlin"):
        assert expected in prompt


@pytest.mark.parametrize("build", SINGLE_Q_BUILDERS)
def test_prompt_with_only_a_role_has_no_leftover_placeholders(build):
    # The classic f-string bug: "... at None (location: None)".
    prompt = build("Data Scientist", None, None)

    assert "Data Scientist" in prompt
    assert "None" not in prompt


def test_grader_prompt_keeps_the_labels_the_parser_depends_on():
    # grading._parse_grade looks for these two labels. If prompt tuning ever
    # drops or renames them, every grade would become a 502 - this test
    # fails first and says why.
    prompt = _build_grader_prompt("Data Scientist", None, None)

    assert "SCORE:" in prompt
    assert "FEEDBACK:" in prompt


def test_interviewer_prompt_asks_for_a_technical_question_not_either_or():
    # The mode is labelled "Technical questions" in the UI. An earlier prompt
    # allowed "behavioral or technical", so the label was only accidentally
    # true - this guards the prompt against drifting back to either/or.
    prompt = _build_interviewer_prompt("Data Scientist", None, None).lower()

    assert "technical question" in prompt
    assert "behavioral or technical" not in prompt


# --- mock interview interviewer prompt ----------------------------------------


def test_mock_prompt_includes_every_supplied_detail():
    prompt = _build_mock_interviewer_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.SENIOR,
        "Data Scientist", "Acme", "Berlin",
    )
    for expected in ("Data Scientist", "Acme", "Berlin", "senior"):
        assert expected in prompt


def test_mock_prompt_with_only_a_role_has_no_leftover_placeholders():
    prompt = _build_mock_interviewer_prompt(
        InterviewType.HR, ExperienceLevel.JUNIOR,
        "Data Scientist", None, None,
    )
    assert "Data Scientist" in prompt
    assert "None" not in prompt


def test_hr_mock_prompt_focuses_on_behavioral_topics():
    prompt = _build_mock_interviewer_prompt(
        InterviewType.HR, ExperienceLevel.MID,
        "ML Engineer", None, None,
    ).lower()
    # The HR prompt should mention behavioral or culture-fit topics,
    # not be framed as a "technical interviewer".
    assert "behavioral" in prompt or "culture" in prompt
    assert "technical interviewer" not in prompt


def test_technical_mock_prompt_focuses_on_technical_topics():
    prompt = _build_mock_interviewer_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.MID,
        "ML Engineer", None, None,
    ).lower()
    assert "technical" in prompt


def test_mock_prompt_includes_end_signal_instruction():
    # The turn loop's _parse_interviewer_reply looks for [END_INTERVIEW].
    # If prompt tuning ever drops this instruction, the model would never
    # signal the end and every interview would hit the hard cap — this test
    # fails first and says why.
    prompt = _build_mock_interviewer_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.MID,
        "ML Engineer", None, None,
    )
    assert "[END_INTERVIEW]" in prompt


# --- mock interview grader prompt ---------------------------------------------


def test_mock_grader_prompt_includes_every_supplied_detail():
    from app.api.routes.interviews import _build_mock_grader_prompt

    prompt = _build_mock_grader_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.SENIOR,
        "Data Scientist", "Acme", "Berlin",
    )
    for expected in ("Data Scientist", "Acme", "Berlin", "senior"):
        assert expected in prompt


def test_mock_grader_prompt_with_only_a_role_has_no_leftover_placeholders():
    from app.api.routes.interviews import _build_mock_grader_prompt

    prompt = _build_mock_grader_prompt(
        InterviewType.HR, ExperienceLevel.JUNIOR,
        "Data Scientist", None, None,
    )
    assert "Data Scientist" in prompt
    assert "None" not in prompt


def test_mock_grader_prompt_keeps_the_labels_the_parser_depends_on():
    from app.api.routes.interviews import _build_mock_grader_prompt

    prompt = _build_mock_grader_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.MID,
        "ML Engineer", None, None,
    )
    assert '"score":' in prompt
    assert '"feedback":' in prompt
    assert '"dimensions":' in prompt
    assert "technical_correctness" in prompt
    assert "depth_of_knowledge" in prompt
    assert "problem_solving" in prompt
    assert "communication" in prompt
    assert "practical_readiness" in prompt


def test_mock_grader_prompt_focuses_appropriately_for_interview_type():
    from app.api.routes.interviews import _build_mock_grader_prompt

    hr_prompt = _build_mock_grader_prompt(
        InterviewType.HR, ExperienceLevel.MID,
        "ML Engineer", None, None,
    ).lower()
    assert "behavioral" in hr_prompt or "communication" in hr_prompt

    tech_prompt = _build_mock_grader_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.MID,
        "ML Engineer", None, None,
    ).lower()
    assert "technical depth" in tech_prompt or "problem-solving" in tech_prompt


def test_interviewer_prompt_enforces_role_fidelity_and_avoids_ai_bias_for_web_roles():
    from app.api.routes.sessions import _build_interviewer_prompt

    prompt = _build_interviewer_prompt("Frontend Engineer", None, None)
    assert "Frontend/UI" in prompt
    assert "DO NOT ask machine learning" in prompt
    assert "ONE clear, focused technical question" in prompt


def test_behavioral_prompts_enforce_star_framework():
    from app.api.routes.grading import _build_behavioral_grader_prompt
    from app.api.routes.sessions import _build_behavioral_interviewer_prompt

    interview_prompt = _build_behavioral_interviewer_prompt("Product Manager", "Stripe", "San Francisco")
    assert "STAR" in interview_prompt
    assert "Product Manager" in interview_prompt
    assert "Stripe" in interview_prompt

    grader_prompt = _build_behavioral_grader_prompt("Product Manager", "Stripe", "San Francisco")
    assert "STAR METHODOLOGY" in grader_prompt
    assert "Situation & Task" in grader_prompt
    assert "Action" in grader_prompt
    assert "Result" in grader_prompt


def test_grader_prompts_include_calibrated_scoring_curve():
    from app.api.routes.grading import _build_grader_prompt

    grader_prompt = _build_grader_prompt("Backend Developer", "Uber", "Seattle")
    assert "GRADING CRITERIA & SCORE CALIBRATION:" in grader_prompt
    assert "9-10" in grader_prompt
    assert "7-8" in grader_prompt
    assert "harsh" not in grader_prompt.lower()  # Verified replaced with constructive calibration


def test_mock_interviewer_prompt_calibrates_seniority_pacing():
    from app.api.routes.interviews import _build_mock_interviewer_prompt

    junior_prompt = _build_mock_interviewer_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.JUNIOR, "DevOps Engineer", None, None
    )
    assert "SENIORITY CALIBRATION (JUNIOR LEVEL)" in junior_prompt
    assert "foundational questions" in junior_prompt

    senior_prompt = _build_mock_interviewer_prompt(
        InterviewType.TECHNICAL, ExperienceLevel.SENIOR, "DevOps Engineer", None, None
    )
    assert "SENIORITY CALIBRATION (SENIOR LEVEL)" in senior_prompt
    assert "high-level architecture" in senior_prompt