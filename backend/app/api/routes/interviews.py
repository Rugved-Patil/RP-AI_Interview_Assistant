"""
Mock interview endpoints (scope doc Section 3.1, Phase 2).

This is a separate route file from sessions.py (Technical questions)
because it's a fundamentally different mode: multi-turn conversational
interview vs. single question + grade. Keeping them separate matches the
scope doc's design decision that each mode owns its own prompt and rubric.

Flow (Step 1 — interview setup):
    POST /interviews/start  -> configures the interview, gets the opening
                               question from Groq, returns session ID + question

Steps 2–3 (turn loop + ending/grading) will add more endpoints here.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.interview import StartInterviewRequest, StartInterviewResponse
from app.services.interview_store import (
    ExperienceLevel,
    InterviewType,
    Turn,
    create_interview,
)
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _build_mock_interviewer_prompt(
    interview_type: InterviewType,
    experience_level: ExperienceLevel,
    role: str,
    company: str | None,
    location: str | None,
) -> str:
    """
    Builds the system prompt for the mock interview interviewer persona.

    This prompt stays the same for the entire interview — it's stored on
    the session at creation time and resent with every turn along with the
    growing transcript (scope doc Section 3.5).

    Deliberately separate from:
      - the single-question prompt in sessions.py (different mode)
      - the holistic grading prompt that will grade the full transcript
        at the end (scope doc 3.3 — interviewer and grader are distinct)

    The prompt does NOT yet include guidance on when to end the interview.
    That will be added in Step 2/3 once the ending mechanism is decided.
    """
    if interview_type is InterviewType.HR:
        persona = f"You are an HR interviewer conducting a full interview for a {role} role"
        focus = (
            "Focus on behavioral questions, culture fit, motivation, career goals, "
            "and interpersonal skills. Use questions like 'Tell me about a time...', "
            "'Why are you interested in...', 'How do you handle...' etc."
        )
    else:
        persona = f"You are a technical interviewer conducting a full interview for a {role} role"
        focus = (
            "Focus on role-specific technical knowledge, problem-solving, system design, "
            "and practical experience. Ask questions that test depth of understanding, "
            "not just surface-level recall."
        )

    if company:
        persona += f" at {company}"
    if location:
        persona += f" (location: {location})"

    persona += f". The candidate has {experience_level.value}-level experience."

    return (
        f"{persona}\n\n"
        f"{focus}\n\n"
        "Conduct a natural, professional interview. Ask ONE question at a time. "
        "After the candidate answers, either ask a relevant follow-up to probe "
        "deeper, or move on to a new topic — as a real interviewer would. "
        "Do not grade, evaluate, or comment on the quality of answers during the "
        "interview. Do not say things like 'Great answer!' or 'That's correct.' "
        "Just ask your next question naturally.\n\n"
        "Reply with ONLY your question. No preamble, no numbering, no commentary."
    )


@router.post("/start", response_model=StartInterviewResponse)
async def start_interview(body: StartInterviewRequest) -> StartInterviewResponse:
    """
    Starts a new mock interview: builds the interviewer persona, gets the
    opening question from Groq, and returns a session ID to continue with.
    """
    provider = get_provider(LLMRole.INTERVIEWER)
    system_prompt = _build_mock_interviewer_prompt(
        body.interview_type,
        body.experience_level,
        body.role,
        body.company,
        body.location,
    )

    try:
        response = await provider.generate(
            [Message(role=Role.SYSTEM, content=system_prompt)],
            temperature=0.9,
            # Generous headroom: same reasoning as sessions.py — the
            # default Groq model is a reasoning model that can burn tokens
            # on chain-of-thought before the visible reply.
            max_tokens=400,
        )
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=502, detail=f"Interviewer provider failed: {exc}"
        ) from exc

    question = response.text.strip()
    if not question:
        raise HTTPException(
            status_code=502, detail="Interviewer provider returned an empty question."
        )

    session = create_interview(
        interview_type=body.interview_type,
        experience_level=body.experience_level,
        role=body.role,
        system_prompt=system_prompt,
        company=body.company,
        location=body.location,
    )

    # Record the opening question in the transcript.
    session.transcript.append(Turn(role="interviewer", content=question))

    return StartInterviewResponse(session_id=session.id, first_question=question)
