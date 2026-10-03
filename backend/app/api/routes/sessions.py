"""
Technical-question practice session endpoints (scope doc Section 3.1).

Naming note: the UI calls this mode "Technical questions", but the route
(`/sessions/situational`) and module keep the original "situational" name on
purpose. Once a second mode exists (e.g. Behavioral) we can decide whether
that means separate endpoints or one endpoint with a `category` field and a
prompt builder per category - and rename everything once, instead of twice.

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

from app.core.config import get_settings
from app.core.languages import build_language_prompt_instruction
from app.schemas.session import (
    CreateSessionRequest,
    CreateSessionResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider
from app.services.rag import format_grounding_block, get_rag_retriever
from app.services.session_store import create_session, get_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _build_interviewer_prompt(
    role: str,
    company: str | None,
    location: str | None,
    language: str | None = None,
) -> str:
    """
    Builds the interviewer persona prompt around whatever context the user
    supplied (scope doc Section 3.4: personalization by role/company/
    location via prompt parameters).

    Phase 6: Strict role-fidelity guardrails to prevent AI/DS bias when the role
    is Frontend, Backend, DevOps, Mobile, QA, etc., with realistic and accessible
    question difficulty.
    """
    context_str = f"for a {role} role"
    if company:
        context_str += f" at {company}"
    if location:
        context_str += f" (location: {location})"

    persona = (
        f"You are an expert, realistic interviewer conducting a focused technical/domain-specific question drill {context_str}.\n\n"
        f"ROLE RELEVANCE & AUTHENTICITY (CRITICAL):\n"
        f"- Your question MUST be directly meaningful, authentic, and specific to the everyday duties, challenges, and core knowledge required for a '{role}'.\n"
        f"- The role can be in any field or industry (e.g. engineering, sports, culinary, education, trades, healthcare, management, creative, executive).\n"
        f"- Do NOT assume or default to Artificial Intelligence, Machine Learning, or unrelated software topics unless the role '{role}' specifically involves AI/ML.\n"
        f"- Ask a realistic, practical question that tests genuine competence, problem-solving, or domain knowledge in that role.\n\n"
        "QUESTION GUIDELINES:\n"
        "- Ask exactly ONE clear, focused technical question relevant to the domain.\n"
        "- Make the question practical, accessible, and grounded in realistic scenarios that a real interviewer for this role would ask.\n"
        "- Do not ask a behavioral or 'tell me about a time' question in this technical/domain drill.\n"
        "- Do not ask multiple sub-questions or provide multiple choices.\n"
        "- Do not include greetings, preamble, introductory commentary, or question numbers.\n"
        "- Reply with ONLY the question text itself."
    )

    settings = get_settings()
    if settings.rag_enabled:
        retriever = get_rag_retriever()
        exemplars = retriever.retrieve(
            query=role,
            category="technical",
            role=role,
            company=company,
            top_k=settings.rag_top_k,
        )
        if exemplars:
            persona += format_grounding_block(exemplars)

    lang_inst = build_language_prompt_instruction(language, is_evaluator=False)
    if lang_inst:
        persona += lang_inst

    return persona


def _build_behavioral_interviewer_prompt(
    role: str,
    company: str | None,
    location: str | None,
    language: str | None = None,
) -> str:
    """
    Builds the behavioral interviewer persona prompt around role/company/location.
    Generates a single open-ended behavioral question (e.g. STAR prompt).

    Phase 6: Tailored workplace situational drills testing core behavioral competencies.
    """
    context_str = f"for a {role} role"
    if company:
        context_str += f" at {company}"
    if location:
        context_str += f" (location: {location})"

    persona = (
        f"You are an expert behavioral interviewer conducting a situational drill {context_str}.\n\n"
        f"INSTRUCTIONS:\n"
        f"- Ask exactly ONE clear, realistic, open-ended behavioral interview question tailored to the real-world situations and interpersonal dynamics typical for a '{role}'.\n"
        f"- Use proven STAR frameworks such as: 'Tell me about a time when...', 'Describe a challenging situation where...', or 'Give an example of how you handled...'.\n"
        f"- Focus on core behavioral dimensions: problem ownership, cross-functional collaboration, resolving technical or interpersonal conflicts, prioritization under tight deadlines, recovering from mistakes, or navigating ambiguity.\n"
        f"- Ground the scenario in realistic industry situations relevant to {role}.\n"
        f"- Do NOT ask technical coding or trivia questions.\n"
        f"- Do NOT ask multiple questions, do not number them, and do not add greetings, preamble, or commentary.\n"
        f"- Reply with ONLY the behavioral question itself."
    )

    settings = get_settings()
    if settings.rag_enabled:
        retriever = get_rag_retriever()
        exemplars = retriever.retrieve(
            query=role,
            category="behavioral",
            role=role,
            company=company,
            top_k=settings.rag_top_k,
        )
        if exemplars:
            persona += format_grounding_block(exemplars)

    lang_inst = build_language_prompt_instruction(language, is_evaluator=False)
    if lang_inst:
        persona += lang_inst

    return persona


@router.post("/situational", response_model=CreateSessionResponse)
async def start_situational_session(body: CreateSessionRequest) -> CreateSessionResponse:
    """Generates or uses a targeted practice question and opens a session for it."""
    if body.question and body.question.strip():
        question = body.question.strip()
    else:
        provider = get_provider(LLMRole.INTERVIEWER)
        system_prompt = _build_interviewer_prompt(body.role, body.company, body.location, body.language)

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
        category="technical",
        language=body.language,
    )
    return CreateSessionResponse(session_id=session.id, question=session.question)


@router.post("/behavioral", response_model=CreateSessionResponse)
async def start_behavioral_session(body: CreateSessionRequest) -> CreateSessionResponse:
    """Generates or uses a targeted behavioral question and opens a session for it."""
    if body.question and body.question.strip():
        question = body.question.strip()
    else:
        provider = get_provider(LLMRole.INTERVIEWER)
        system_prompt = _build_behavioral_interviewer_prompt(body.role, body.company, body.location, body.language)

        try:
            response = await provider.generate(
                [Message(role=Role.SYSTEM, content=system_prompt)],
                temperature=0.9,
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

    session = create_session(
        question=question,
        role=body.role,
        company=body.company,
        location=body.location,
        category="behavioral",
        language=body.language,
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