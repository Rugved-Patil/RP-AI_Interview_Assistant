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
    context the question was generated with (stored on the session - see
    session_store.TechnicalSession), so the bar for "good answer" reflects
    what this specific role/company/location context would need rather
    than a role-agnostic average.
    """
    context = f"a {role} role"
    if company:
        context += f" at {company}"
    if location:
        context += f" (location: {location})"

    return (
        f"You are grading a candidate's answer to a single interview question for {context}. "
        "Keep the grading harsh but realistic, and calibrate your expectations to what would "
        "actually be expected for this role (and this company/location, if given) rather than "
        "grading in the abstract. "
        "Reply with EXACTLY this format and nothing else:\n"
        "SCORE: <an integer from 0 to 10>\n"
        "FEEDBACK: <two or three sentences of specific, constructive feedback>"
    )


@router.post("/{session_id}/grade", response_model=GradeResponse)
async def grade_session(session_id: str) -> GradeResponse:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.answer is None:
        raise HTTPException(status_code=400, detail="No answer submitted for this session yet")

    provider = get_provider(LLMRole.GRADER)
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