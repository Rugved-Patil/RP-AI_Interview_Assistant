"""
Per-answer grading endpoint (scope doc Section 3.3: "Situational practice:
graded per answer").

Uses the GRADER provider (Gemini), with a system prompt separate from the
interviewer persona in sessions.py - per the scope doc's Decisions Log
(Section 7.2), interviewer and grading prompts are deliberately distinct
and expected to be iterated on empirically. This is a first-pass prompt,
not a final one.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException

from app.schemas.session import GradeResponse
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider
from app.services.session_store import get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["grading"])


class GradeParseError(ValueError):
    """The grader's reply didn't contain a usable SCORE and FEEDBACK."""


# Forgiving about *decoration* around the labels, strict about the labels
# themselves: the prompt asks for "SCORE:" / "FEEDBACK:", so the colon is
# required. Accepts "SCORE: 7", "**SCORE:** 7", "**SCORE**: 7", "**SCORE: 7**"
# and "Score: 7/10". The mandatory colon matters most for FEEDBACK: with an
# optional colon, a bare "FEEDBACK:" would capture the colon itself as text.
_SCORE_RE = re.compile(r"SCORE\**\s*:\s*\**\s*(\d+)", re.IGNORECASE)
_FEEDBACK_RE = re.compile(r"FEEDBACK\**\s*:\s*\**\s*(.+)", re.IGNORECASE | re.DOTALL)


def _build_grader_prompt(role: str, company: str | None, location: str | None) -> str:
    """
    Builds the grading persona prompt using the same role/company/location
    context the question was generated with.

    Phase 6: Encouraging, constructive, and realistically calibrated grading curve
    (solid answers score 7-8/10, reserving 9-10 for comprehensive mastery with trade-offs).
    """
    context = f"a {role} role"
    if company:
        context += f" at {company}"
    if location:
        context += f" (location: {location})"

    return (
        f"You are an encouraging, objective, and experienced technical interviewer grading a candidate's answer to a single technical interview question for {context}.\n\n"
        "GRADING CRITERIA & SCORE CALIBRATION:\n"
        "- 9-10: Exceptional / Masterful. Completely accurate, mentions nuances, edge cases, or practical trade-offs.\n"
        "- 7-8: Solid / Competent. Accurate core answer with good understanding that comfortably meets the real-world hiring bar.\n"
        "- 5-6: Developing / Partial. Basic premise understood, but contains minor inaccuracies, hand-waving, or missing key aspects.\n"
        "- 3-4: Substantial Gaps. Significant factual errors or fundamentally flawed reasoning.\n"
        "- 0-2: Inadequate / Off-topic.\n\n"
        "FEEDBACK PRINCIPLES:\n"
        "- Be constructive, direct, and actionable. First acknowledge what the candidate explained correctly, then clearly identify the missing nuance or trade-off they can add to level up.\n\n"
        "Reply with EXACTLY this format and nothing else:\n"
        "SCORE: <an integer from 0 to 10>\n"
        "FEEDBACK: <two or three sentences of specific, constructive feedback>"
    )


def _build_behavioral_grader_prompt(role: str, company: str | None, location: str | None) -> str:
    """
    Builds the STAR-method grading prompt for behavioral interview questions.
    Evaluates Situation, Task, Action, and Result with constructive, encouraging guidance.
    """
    context = f"a {role} role"
    if company:
        context += f" at {company}"
    if location:
        context += f" (location: {location})"

    return (
        f"You are an expert, encouraging behavioral interviewer evaluating a candidate's response to a behavioral interview question for {context}.\n\n"
        "EVALUATION CRITERIA (STAR METHODOLOGY):\n"
        "- Situation & Task: Did the candidate establish clear context and define the challenge?\n"
        "- Action: Did they focus on their personal decisions and contributions (using 'I' vs vague team 'we')?\n"
        "- Result: Did they describe tangible impact, measurable outcomes, or lessons learned?\n\n"
        "SCORING CALIBRATION:\n"
        "- 9-10: Complete STAR story with clear personal agency, conflict/challenge resolution, and quantified or tangible impact.\n"
        "- 7-8: Strong STAR structure with clear actions and outcome; meets the real-world behavioral hiring bar.\n"
        "- 5-6: Partial story (e.g. good context but vague on personal action, or missing a clear outcome).\n"
        "- 3-4: Generic statements or purely theoretical responses without a specific real-world situation.\n"
        "- 0-2: Off-topic or non-responsive.\n\n"
        "FEEDBACK PRINCIPLES:\n"
        "- Provide personalized, encouraging feedback highlighting what worked in their delivery and offering one specific tip to strengthen their storytelling.\n\n"
        "Reply with EXACTLY this format and nothing else:\n"
        "SCORE: <an integer from 0 to 10>\n"
        "FEEDBACK: <two to four sentences of constructive feedback explicitly referencing their STAR structure and impact>"
    )


@router.post("/{session_id}/grade", response_model=GradeResponse)
async def grade_session(session_id: str) -> GradeResponse:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.answer is None:
        raise HTTPException(status_code=400, detail="No answer submitted for this session yet")

    provider = get_provider(LLMRole.GRADER)
    if getattr(session, "category", "technical") == "behavioral":
        system_prompt = _build_behavioral_grader_prompt(session.role, session.company, session.location)
    else:
        system_prompt = _build_grader_prompt(session.role, session.company, session.location)

    try:
        response = await provider.generate(
            [
                Message(role=Role.SYSTEM, content=system_prompt),
                Message(
                    role=Role.USER,
                    content=f"Question: {session.question}\n\nCandidate's answer: {session.answer}",
                ),
            ],
            temperature=0.3,  # low temperature: grading should be consistent, not creative
            # Generous headroom: gemini-3.6-flash is a reasoning model, and its
            # thinking tokens count against this same limit as the visible
            # reply (see gemini_provider.py) - too little and the reply comes
            # back empty rather than raising an error.
            max_tokens=4096,
        )
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=f"Grader provider failed: {exc}") from exc

    text = response.text.strip()
    if not text:
        raise HTTPException(status_code=502, detail="Grader provider returned an empty reply.")

    try:
        score, feedback = _parse_grade(text)
    except GradeParseError as exc:
        # Log the raw reply: an unparseable grade is exactly the kind of
        # evidence needed when tuning the grader prompt (scope doc 7.2).
        logger.warning("Unparseable grader reply (%s): %r", exc, text[:500])
        raise HTTPException(
            status_code=502,
            detail="The grader's reply wasn't in the expected format - please retry.",
        ) from exc

    # Only reached with a valid grade: on any failure above the session stays
    # ungraded, so /save correctly refuses it and a retry can re-grade it.
    session.score = score
    session.feedback = feedback

    return GradeResponse(session_id=session.id, score=score, feedback=feedback)


def _parse_grade(text: str) -> tuple[int, str]:
    """
    Pulls SCORE and FEEDBACK back out of the model's reply text.

    Why regex instead of trusting the format exactly: LLMs don't reliably
    stick to a requested format 100% of the time, even a simple one, so the
    patterns above tolerate decoration (markdown bolding, extra whitespace).

    What happens when parsing still fails: raises GradeParseError instead of
    inventing a value. An earlier version fell back to score 0 plus the raw
    text, but a fabricated 0 looks exactly like a real 0 - and could be
    saved as one. A visible error the user can retry is more honest than a
    plausible-looking wrong grade.
    """
    score_match = _SCORE_RE.search(text)
    if score_match is None:
        raise GradeParseError("no SCORE found in the grader's reply")

    feedback_match = _FEEDBACK_RE.search(text)
    # rstrip("*") removes the closing markdown bold left behind by replies
    # like "**FEEDBACK: Needs examples.**".
    feedback = feedback_match.group(1).strip().rstrip("*").strip() if feedback_match else ""
    if not feedback:
        raise GradeParseError("no FEEDBACK found in the grader's reply")

    # Clamp in case the model ignores the requested 0-10 range.
    score = max(0, min(10, int(score_match.group(1))))
    return score, feedback