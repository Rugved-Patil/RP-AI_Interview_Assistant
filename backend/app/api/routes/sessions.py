"""
Situational practice session endpoints (scope doc Section 3.1).

Flow for this route file:
    POST /sessions/situational          -> generates one question, opens a session
    POST /sessions/{session_id}/answer  -> stores the user's answer text

Grading is deliberately a separate route file (grading.py) even though it's
also nested under /sessions/{session_id} - "generate a question" and "grade
an answer" use two different LLM roles/providers/prompts, and splitting
them keeps each file focused on one concern, same reasoning as health.py
being split out from main.py.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider
from app.services.session_store import create_session, get_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _build_interviewer_prompt(role: str, company: str | None, location: str | None) -> str:
    """
    Builds the interviewer persona prompt around whatever context the user
    supplied (scope doc Section 3.4: personalization by role/company/
    location via prompt parameters). `role` is validated non-blank on the
    request schema, so it's always safe to interpolate here; company/
    location are optional and simply omitted from the sentence rather than
    leaving an awkward blank when not given.

    Deliberately separate from the grading prompt in grading.py (scope doc
    Section 7.2: interviewer vs. grading personas are distinct prompts,
    iterated on empirically - this is a first pass, not a final version).
    """
    persona = f"You are a technical interviewer for a {role} role"
    if company:
        persona += f" at {company}"
    if location:
        persona += f" (location: {location})"
    persona += (
        ". Ask exactly ONE clear, focused interview question - a single "
        "behavioral or technical question relevant to this role. Keep the "
        "question difficulty medium. Do not ask multiple questions, do not "
        "number them, do not add preamble, explanation, or commentary. Reply "
        "with nothing but the question itself."
    )
    return persona


@router.post("/situational", response_model=CreateSessionResponse)
async def start_situational_session(body: CreateSessionRequest) -> CreateSessionResponse:
    """Generates a single practice question via the INTERVIEWER provider and opens a session for it."""
    provider = get_provider(LLMRole.INTERVIEWER)
    system_prompt = _build_interviewer_prompt(body.role, body.company, body.location)

    try:
        response = await provider.generate(
            [Message(role=Role.SYSTEM, content=system_prompt)],
            temperature=0.9,
            # Generous headroom: gpt-oss-20b is a reasoning model that can
            # burn tokens on internal chain-of-thought before writing the
            # visible question (see groq_provider.py's docstring) - too low
            # a limit here silently returns empty text, not an error.
            max_tokens=400,
        )
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=502, detail=f"Interviewer provider failed: {exc}"
        ) from exc

    question = response.text.strip()
    if not question:
        # Belt-and-suspenders: if a future model swap reintroduces the
        # empty-response issue, fail loudly here instead of opening a
        # session with a blank question.
        raise HTTPException(
            status_code=502, detail="Interviewer provider returned an empty question."
        )

    session = create_session(
        question=question,
        role=body.role,
        company=body.company,
        location=body.location,
    )
    return CreateSessionResponse(session_id=session.id, question=session.question)


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
def submit_answer(session_id: str, body: SubmitAnswerRequest) -> SubmitAnswerResponse:
    """Records the user's answer text against an existing session, ready for grading."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.answer = body.answer
    return SubmitAnswerResponse(session_id=session.id)