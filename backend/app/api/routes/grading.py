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

import re

from fastapi import APIRouter, HTTPException

from app.schemas.session import GradeResponse
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider
from app.services.session_store import get_session

router = APIRouter(prefix="/sessions", tags=["grading"])

_GRADER_SYSTEM_PROMPT = (
    "You are grading a candidate's answer to a single interview question."
    "Keep the grading harsh but realistic"
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

    try:
        response = await provider.generate(
            [
                Message(role=Role.SYSTEM, content=_GRADER_SYSTEM_PROMPT),
                Message(
                    role=Role.USER,
                    content=f"Question: {session.question}\n\nCandidate's answer: {session.answer}",
                ),
            ],
            temperature=0.3,  # low temperature: grading should be consistent, not creative
            max_tokens=1024,  # generous headroom - gemini-3.6-flash is also a reasoning model
        )
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=f"Grader provider failed: {exc}") from exc

    score, feedback = _parse_grade(response.text)

    session.score = score
    session.feedback = feedback

    return GradeResponse(session_id=session.id, score=score, feedback=feedback)


def _parse_grade(text: str) -> tuple[int, str]:
    """
    Pulls SCORE and FEEDBACK back out of the model's reply text.

    Why regex instead of trusting the format exactly: LLMs don't reliably
    stick to a requested format 100% of the time, even a simple one. This
    is a deliberately forgiving parser so a slightly-off-format reply
    (extra whitespace, a stray blank line, markdown bolding around
    "SCORE:") doesn't throw and 500 the whole request. If parsing fails
    outright, it falls back to a 0 score with the raw reply as feedback -
    a visibly-wrong grade the user can see is better than a crashed request.
    """
    score_match = re.search(r"SCORE:\s*(\d+)", text, re.IGNORECASE)
    feedback_match = re.search(r"FEEDBACK:\s*(.+)", text, re.IGNORECASE | re.DOTALL)

    score = int(score_match.group(1)) if score_match else 0
    score = max(0, min(10, score))  # clamp in case the model ignores the requested 0-10 range

    feedback = feedback_match.group(1).strip() if feedback_match else text.strip()

    return score, feedback