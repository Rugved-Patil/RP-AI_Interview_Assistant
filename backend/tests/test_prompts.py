"""
Invariants for the two prompt builders - deliberately NOT their exact wording.

The scope doc (Section 7.2) says both prompts will be tuned empirically, so
tests that pinned the wording would fail on every tweak and end up deleted.
These pin only what must stay true however the prompts get reworded.
"""

import pytest

from app.api.routes.grading import _build_grader_prompt
from app.api.routes.sessions import _build_interviewer_prompt

BUILDERS = [_build_interviewer_prompt, _build_grader_prompt]


@pytest.mark.parametrize("build", BUILDERS)
def test_prompt_includes_every_supplied_detail(build):
    prompt = build("Data Scientist", "Acme", "Berlin")

    for expected in ("Data Scientist", "Acme", "Berlin"):
        assert expected in prompt


@pytest.mark.parametrize("build", BUILDERS)
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