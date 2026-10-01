"""
Mock interview endpoints (scope doc Section 3.1, Phase 2).

This is a separate route file from sessions.py (Technical questions)
because it's a fundamentally different mode: multi-turn conversational
interview vs. single question + grade. Keeping them separate matches the
scope doc's design decision that each mode owns its own prompt and rubric.

Flow:
    POST /interviews/start            -> configures the interview, gets the
                                         opening question from Groq, returns
                                         session ID + question
    POST /interviews/{id}/answer      -> appends the user's answer to the
                                         transcript, gets the next question
                                         (or an end signal), returns it
    POST /interviews/{id}/end         -> explicitly ends an in-progress interview
    POST /interviews/{id}/grade       -> holistically grades the full transcript
                                         using Gemini (GRADER role)
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.routes.grading import GradeParseError, _parse_grade
from app.core.config import get_settings
from app.db.base import get_db
from app.db.models import SavedInterviewReport
from app.schemas.interview import (
    DeleteInterviewReportResponse,
    EndInterviewResponse,
    InterviewAnswerRequest,
    InterviewAnswerResponse,
    InterviewDimensions,
    InterviewGradeResponse,
    SaveInterviewReportResponse,
    SavedInterviewReportSummary,
    StartInterviewRequest,
    StartInterviewResponse,
    TurnSchema,
)
from app.services.interview_store import (
    ExperienceLevel,
    InterviewSession,
    InterviewStatus,
    InterviewType,
    Turn,
    create_interview,
    get_interview,
)
from app.services.llm import LLMProviderError, LLMRole, Message, Role, get_provider
from app.services.rag import format_grounding_block, get_rag_retriever

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interviews", tags=["interviews"])

# --- constants ----------------------------------------------------------------

# Hard ceiling on questions asked per interview (safety net).
# The prompt aims for 5-8; this cap prevents runaway conversations
# when the model ignores the guidance.
MAX_QUESTIONS = 10

# The token the model emits when it decides the interview is done.
END_SIGNAL = "[END_INTERVIEW]"


# --- prompt builders ----------------------------------------------------------


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

    Phase 3: When RAG is enabled, retrieves relevant exemplar questions from
    the curated question bank to ground interviewer dialogue.

    Deliberately separate from:
      - the single-question prompt in sessions.py (different mode)
      - the holistic grading prompt that will grade the full transcript
        at the end (scope doc 3.3 — interviewer and grader are distinct)
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

    prompt_body = (
        f"{persona}\n\n"
        f"{focus}\n\n"
        "Conduct a natural, professional interview. Ask ONE question at a time. "
        "After the candidate answers, either ask a relevant follow-up to probe "
        "deeper, or move on to a new topic — as a real interviewer would. "
        "Do not grade, evaluate, or comment on the quality of answers during the "
        "interview. Do not say things like 'Great answer!' or 'That's correct.' "
        "Just ask your next question naturally.\n\n"
        "Reply with ONLY your question — no preamble, no numbering, no commentary.\n\n"
        "Aim for around 5 to 8 questions total (including follow-ups). When you "
        "feel the interview has covered enough ground, end it naturally: say a "
        "brief closing line (e.g., 'Thank you, that covers everything I wanted "
        "to discuss today.') followed by [END_INTERVIEW] on a new line at the "
        "very end of your reply. Do not use [END_INTERVIEW] in your opening "
        "question."
    )

    settings = get_settings()
    if settings.rag_enabled:
        retriever = get_rag_retriever()
        category_filter = "behavioral" if interview_type is InterviewType.HR else "technical"
        difficulty_filter = experience_level.value if experience_level.value in ("junior", "mid", "senior", "lead") else None
        exemplars = retriever.retrieve(
            query=role,
            category=category_filter,  # type: ignore[arg-type]
            difficulty=difficulty_filter,  # type: ignore[arg-type]
            role=role,
            company=company,
            top_k=settings.rag_top_k,
        )
        if exemplars:
            prompt_body += format_grounding_block(exemplars)

    return prompt_body


REQUIRED_DIMENSIONS = (
    "technical_correctness",
    "depth_of_knowledge",
    "problem_solving",
    "communication",
    "practical_readiness",
)


def _build_mock_grader_prompt(
    interview_type: InterviewType,
    experience_level: ExperienceLevel,
    role: str,
    company: str | None,
    location: str | None,
) -> str:
    """
    Builds the system prompt for the holistic mock interview grader persona (Gemini).

    Scope doc Section 3.3: "Full mock interview: graded holistically at the end
    from the full transcript, using a separate 'grading' prompt distinct from the
    'interviewer' prompt used during the conversation."

    Enforces evidence-based evaluation, per-dimension diagnostic scoring (0-10),
    level calibration, strict depth assessment, explicit recognition of unverified
    skills, and structured JSON output.
    """
    context = f"Target Role: {role}\nExperience Level: {experience_level.value}"
    if company:
        context += f"\nTarget Company: {company}"
    if location:
        context += f"\nLocation: {location}"

    if interview_type is InterviewType.HR:
        domain_guidelines = (
            "EVALUATION CRITERIA (BEHAVIORAL / HR FOCUS):\n"
            "- Communication & Structure: Assess clarity, conciseness, and structured storytelling (e.g., STAR method: Situation, Task, Action, Result).\n"
            "- Behavioral Competence: Look for demonstrated ownership, conflict resolution, collaboration, adaptability, leadership, and self-awareness.\n"
            "- Evidence vs. Generic Claims: Credit specific actions taken and measurable outcomes rather than vague assertions or generic buzzwords."
        )
    else:
        domain_guidelines = (
            "EVALUATION CRITERIA (TECHNICAL FOCUS):\n"
            "- Conceptual Accuracy & Correctness: Identify factual errors, flawed assumptions, or misapplied concepts. Do not penalize reasonable simplifications that do not affect core correctness.\n"
            "- Depth & Technical Reasoning: Distinguish between merely naming buzzwords (e.g., FSDP, FlashAttention, RoPE, Kubernetes, RAG) and demonstrating genuine mastery (explaining how/why it works, trade-offs, edge cases, and limitations).\n"
            "- Problem-Solving & Architecture: Assess ability to reason through architectural decisions, system constraints, trade-offs, and practical failure modes."
        )

    return (
        "You are an expert, objective, and calibrated interview evaluator assessing a complete mock interview transcript.\n\n"
        f"{context}\n\n"
        f"{domain_guidelines}\n\n"
        "CORE EVALUATION PRINCIPLES:\n"
        "1. Evidence Over Inference: Only award credit for competencies and knowledge explicitly demonstrated in the candidate's answers. Mentioning an advanced term is NOT by itself evidence of deep understanding.\n"
        "2. Level Calibration: Evaluate expectations relative to the candidate's stated experience level (Fresher / Mid-Level / Senior / Lead). Do not demand senior-level architecture depth from a fresher, but do NOT inflate scores or award unearned credit simply because the candidate is junior.\n"
        "3. Resist Generic Praise & Inflation: Avoid buzzword praise (e.g., 'exceptional', 'outstanding', 'industry-grade', 'expert-level') unless the transcript provides rigorous evidence justifying it. High scores (9-10) are reserved for exceptional mastery, trade-off analysis, and precision.\n"
        "4. Scope & Unverified Skills: A skill that was not tested cannot automatically be assumed to be strong. If the interview did not test coding, debugging, implementation, or practical engineering decisions, explicitly treat those areas as not fully verified rather than assuming strong ability.\n"
        "5. Evidence-Backed Findings: Every strength and area for improvement MUST cite specific examples, concepts, or statements from the candidate's answers. Do not hallucinate or fabricate quotes.\n\n"
        "EVALUATION DIMENSIONS (Score each 0-10):\n"
        "1. technical_correctness: Factual accuracy of technical/domain answers, correct use of concepts, absence of significant misconceptions, and viability of proposed approaches. Do not confuse verbosity with correctness.\n"
        "2. depth_of_knowledge: Depth of understanding beyond textbook definitions — explaining mechanisms, trade-offs, why an approach works, limitations, edge cases, and connecting concepts.\n"
        "3. problem_solving: How effectively the candidate reasons through problems — problem decomposition, logical deduction, identifying constraints, evaluating alternatives, handling trade-offs, and adapting to follow-up questions. Score only demonstrated reasoning, not knowledge of facts.\n"
        "4. communication: Clarity, structure, conciseness, coherence, directly answering the question, and explaining complex concepts without unnecessary jargon.\n"
        "5. practical_readiness: Evidence of applied engineering ability — implementation thinking, debugging, testing, production considerations, failure modes, and practical design. If not tested in this conversational interview, score conservatively based only on available evidence and note that practical skills were not verified.\n\n"
        "DIMENSION SCORING RUBRIC (0 to 10 Scale):\n"
        "- 10: Exceptional evidence; consistently deep, correct, well-reasoned performance with very few meaningful gaps.\n"
        "- 9: Excellent; clearly above expectations for the level with only minor gaps.\n"
        "- 8: Strong; generally correct and well-reasoned with good depth, but with meaningful gaps or unverified areas.\n"
        "- 7: Good; generally correct with some high-level, incomplete, or inconsistent areas.\n"
        "- 6: Adequate; useful understanding but noticeable gaps or shallow reasoning.\n"
        "- 5: Mixed; significant gaps, vagueness, or some important errors.\n"
        "- 3-4: Weak; substantial deficiencies or frequent misunderstandings.\n"
        "- 1-2: Very weak evidence; major inaccuracies or incoherent answers.\n"
        "- 0: No meaningful evidence.\n\n"
        "OVERALL SCORE:\n"
        "The overall score (0-10 integer) must be a holistic assessment of the complete interview, NOT a simple arithmetic average of the five dimensions.\n\n"
        "REQUIRED OUTPUT FORMAT:\n"
        "Respond with a valid JSON object matching this exact structure:\n"
        "```json\n"
        "{\n"
        '  "score": 8,\n'
        '  "feedback": {\n'
        '    "overall_impression": "2-4 sentences summarizing candidate\'s demonstrated performance calibrated to their target role and level.",\n'
        '    "key_strengths": [\n'
        '      "Strength 1 referencing specific evidence from answers",\n'
        '      "Strength 2 referencing specific evidence from answers"\n'
        "    ],\n"
        '    "areas_for_improvement": [\n'
        '      "Area 1 referencing specific gaps, errors, or shallow explanations from answers",\n'
        '      "Area 2 referencing specific gaps, errors, or shallow explanations from answers"\n'
        "    ],\n"
        '    "skills_not_fully_verified": [\n'
        '      "Skill or domain area not tested or only touched superficially in this interview format"\n'
        "    ],\n"
        '    "recommended_preparation": [\n'
        '      "Actionable preparation item 1 targeting identified gaps",\n'
        '      "Actionable preparation item 2 targeting identified gaps"\n'
        "    ]\n"
        "  },\n"
        '  "dimensions": {\n'
        '    "technical_correctness": 8,\n'
        '    "depth_of_knowledge": 8,\n'
        '    "problem_solving": 7,\n'
        '    "communication": 9,\n'
        '    "practical_readiness": 6\n'
        "  }\n"
        "}\n"
        "```"
    )


def _format_feedback_dict(data: dict) -> str:
    """Formats a structured feedback dict into clean markdown sections."""
    sections: list[str] = []

    impression = data.get("overall_impression")
    if impression and isinstance(impression, str) and impression.strip():
        sections.append(f"### Overall Impression\n{impression.strip()}")

    strengths = data.get("key_strengths")
    if strengths and isinstance(strengths, list):
        items = "\n".join(f"- {s.strip()}" for s in strengths if isinstance(s, str) and s.strip())
        if items:
            sections.append(f"### Key Strengths\n{items}")

    weaknesses = data.get("areas_for_improvement")
    if weaknesses and isinstance(weaknesses, list):
        items = "\n".join(f"- {w.strip()}" for w in weaknesses if isinstance(w, str) and w.strip())
        if items:
            sections.append(f"### Areas for Improvement\n{items}")

    unverified = data.get("skills_not_fully_verified")
    if unverified and isinstance(unverified, list):
        items = "\n".join(f"- {u.strip()}" for u in unverified if isinstance(u, str) and u.strip())
        if items:
            sections.append(f"### Skills Not Fully Verified\n{items}")

    prep = data.get("recommended_preparation")
    if prep and isinstance(prep, list):
        items = "\n".join(f"- {p.strip()}" for p in prep if isinstance(p, str) and p.strip())
        if items:
            sections.append(f"### Recommended Preparation\n{items}")

    if sections:
        return "\n\n".join(sections)
    return str(data)


def _parse_mock_grade(text: str) -> tuple[int, str, InterviewDimensions | None]:
    """
    Parses score, feedback, and structured dimension scores from Gemini's response.
    Supports JSON output, markdown-fenced JSON, and legacy regex text fallback.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            raw_score = data.get("score")
            if raw_score is not None:
                score = max(0, min(10, int(raw_score)))

                raw_feedback = data.get("feedback")
                if isinstance(raw_feedback, dict):
                    feedback = _format_feedback_dict(raw_feedback)
                elif isinstance(raw_feedback, str) and raw_feedback.strip():
                    feedback = raw_feedback.strip()
                else:
                    feedback = "Evaluation completed."

                raw_dims = data.get("dimensions")
                dims: InterviewDimensions | None = None
                if isinstance(raw_dims, dict):
                    try:
                        validated_dims = {}
                        for key in REQUIRED_DIMENSIONS:
                            if key in raw_dims:
                                validated_dims[key] = max(0, min(10, int(raw_dims[key])))
                        if len(validated_dims) == len(REQUIRED_DIMENSIONS):
                            dims = InterviewDimensions(**validated_dims)
                    except (ValueError, TypeError):
                        logger.warning("Malformed dimensions in grader response: %r", raw_dims)
                        dims = None

                return score, feedback, dims
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # Fallback to standard regex text parsing
    score, feedback = _parse_grade(text)
    return score, feedback, None


# --- helpers ------------------------------------------------------------------


def _transcript_to_messages(session: InterviewSession) -> list[Message]:
    """
    Converts the stored transcript to the LLM Message list format.

    The system prompt (stored on the session at creation time) goes first,
    then each interviewer turn becomes ASSISTANT and each candidate turn
    becomes USER — the standard chat-completion shape.
    """
    messages = [Message(role=Role.SYSTEM, content=session.system_prompt)]
    for turn in session.transcript:
        if turn.role == "interviewer":
            messages.append(Message(role=Role.ASSISTANT, content=turn.content))
        else:
            messages.append(Message(role=Role.USER, content=turn.content))
    return messages


def _format_transcript_for_grading(transcript: list[Turn]) -> str:
    """Formats the running transcript into readable multi-turn dialogue text."""
    formatted = []
    for turn in transcript:
        label = "Interviewer" if turn.role == "interviewer" else "Candidate"
        formatted.append(f"{label}: {turn.content}")
    return "\n\n".join(formatted)


def _parse_interviewer_reply(text: str) -> tuple[str, bool]:
    """
    Checks the model's reply for the end signal.

    Returns (cleaned_message, interview_ended). If the signal is present,
    it's stripped and any remaining text (a closing remark) is returned.
    """
    if END_SIGNAL in text:
        message = text.replace(END_SIGNAL, "").strip()
        return message, True
    return text, False


# --- endpoints ----------------------------------------------------------------


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


@router.post("/{session_id}/answer", response_model=InterviewAnswerResponse)
async def submit_interview_answer(
    session_id: str, body: InterviewAnswerRequest
) -> InterviewAnswerResponse:
    """
    Appends the user's answer to the transcript, sends the full conversation
    to Groq for the next question (or end signal), and returns the result.

    Three ways an interview can end:
      1. The model emits [END_INTERVIEW] — natural ending.
      2. The backend hits MAX_QUESTIONS — safety cap.
      3. The user ends early via POST /interviews/{id}/end.
    """
    session = get_interview(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if session.status is not InterviewStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=409, detail="This interview has already ended."
        )

    # Append the candidate's answer to the transcript.
    session.transcript.append(Turn(role="candidate", content=body.answer))

    questions_asked = sum(1 for t in session.transcript if t.role == "interviewer")
    turn_number = sum(1 for t in session.transcript if t.role == "candidate")

    # Hard cap: all questions have been asked and answered — end without
    # another Groq call.
    if questions_asked >= MAX_QUESTIONS:
        session.status = InterviewStatus.COMPLETED
        return InterviewAnswerResponse(
            session_id=session.id,
            interviewer_message=None,
            interview_ended=True,
            turn_number=turn_number,
        )

    # Send the full transcript to Groq for the next question.
    provider = get_provider(LLMRole.INTERVIEWER)
    messages = _transcript_to_messages(session)

    try:
        response = await provider.generate(
            messages,
            temperature=0.9,
            max_tokens=400,
        )
    except LLMProviderError as exc:
        # Roll back the answer so the user can retry the same submission.
        session.transcript.pop()
        raise HTTPException(
            status_code=502, detail=f"Interviewer provider failed: {exc}"
        ) from exc

    raw_reply = response.text.strip()
    if not raw_reply:
        session.transcript.pop()
        raise HTTPException(
            status_code=502,
            detail="Interviewer provider returned an empty reply.",
        )

    interviewer_message, ended = _parse_interviewer_reply(raw_reply)

    if ended:
        session.status = InterviewStatus.COMPLETED
        # Store the closing remark (if any) in the transcript for grading.
        if interviewer_message:
            session.transcript.append(
                Turn(role="interviewer", content=interviewer_message)
            )
    else:
        session.transcript.append(
            Turn(role="interviewer", content=interviewer_message)
        )

    return InterviewAnswerResponse(
        session_id=session.id,
        interviewer_message=interviewer_message or None,
        interview_ended=ended,
        turn_number=turn_number,
    )


@router.post("/{session_id}/end", response_model=EndInterviewResponse)
async def end_interview(session_id: str) -> EndInterviewResponse:
    """
    Explicitly ends an in-progress interview at the user's request so they
    can proceed to holistic grading.
    """
    session = get_interview(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    if session.status is InterviewStatus.IN_PROGRESS:
        session.status = InterviewStatus.COMPLETED

    return EndInterviewResponse(session_id=session.id, status=session.status.value)


@router.post("/{session_id}/grade", response_model=InterviewGradeResponse)
async def grade_interview(session_id: str) -> InterviewGradeResponse:
    """
    Holistically grades the entire mock interview transcript using Gemini
    (GRADER role). Calibrates assessment to the interview type, experience
    level, and target role/company/location.
    """
    session = get_interview(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    candidate_answers = sum(1 for t in session.transcript if t.role == "candidate")
    if candidate_answers == 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot grade an interview with no answers submitted.",
        )

    provider = get_provider(LLMRole.GRADER)
    system_prompt = _build_mock_grader_prompt(
        session.interview_type,
        session.experience_level,
        session.role,
        session.company,
        session.location,
    )
    transcript_text = _format_transcript_for_grading(session.transcript)

    try:
        response = await provider.generate(
            [
                Message(role=Role.SYSTEM, content=system_prompt),
                Message(
                    role=Role.USER,
                    content=f"Full Interview Transcript:\n\n{transcript_text}",
                ),
            ],
            temperature=0.3,
            max_tokens=4096,
        )
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=502, detail=f"Grader provider failed: {exc}"
        ) from exc

    text = response.text.strip()
    if not text:
        raise HTTPException(
            status_code=502, detail="Grader provider returned an empty reply."
        )

    try:
        score, feedback, dimensions = _parse_mock_grade(text)
    except GradeParseError as exc:
        logger.warning("Unparseable mock interview grader reply (%s): %r", exc, text[:500])
        raise HTTPException(
            status_code=502,
            detail="The grader's reply wasn't in the expected format - please retry.",
        ) from exc

    session.score = score
    session.feedback = feedback
    session.dimensions = dimensions.model_dump() if dimensions else None
    session.status = InterviewStatus.GRADED

    return InterviewGradeResponse(
        session_id=session.id,
        score=score,
        feedback=feedback,
        dimensions=dimensions,
    )


@router.post("/{session_id}/save", response_model=SaveInterviewReportResponse)
def save_interview_report(
    session_id: str, db: Session = Depends(get_db)
) -> SaveInterviewReportResponse:
    """
    Opt-in save endpoint for a completed and graded mock interview session.
    Saves full transcript turns as JSON, along with score, feedback, and configuration.
    """
    session = get_interview(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if session.status is not InterviewStatus.GRADED or session.score is None or session.feedback is None:
        raise HTTPException(
            status_code=400, detail="Interview has not been graded yet."
        )

    transcript_data = [{"role": t.role, "content": t.content} for t in session.transcript]
    transcript_json = json.dumps(transcript_data)

    report = SavedInterviewReport(
        session_id=session.id,
        interview_type=session.interview_type.value,
        experience_level=session.experience_level.value,
        role=session.role,
        company=session.company,
        location=session.location,
        score=session.score,
        feedback=session.feedback,
        transcript_json=transcript_json,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(SavedInterviewReport).where(SavedInterviewReport.session_id == session_id)
        )
        if existing is not None:
            return SaveInterviewReportResponse(id=existing.id, session_id=session_id)
        raise HTTPException(status_code=500, detail="Failed to save report.")

    db.refresh(report)
    return SaveInterviewReportResponse(id=report.id, session_id=report.session_id)


@router.get("/reports", response_model=list[SavedInterviewReportSummary])
def list_interview_reports(
    db: Session = Depends(get_db),
) -> list[SavedInterviewReportSummary]:
    """
    Returns saved mock interview reports ordered by created_at descending.
    """
    reports = db.scalars(
        select(SavedInterviewReport).order_by(SavedInterviewReport.created_at.desc())
    ).all()

    results: list[SavedInterviewReportSummary] = []
    for r in reports:
        try:
            turns = json.loads(r.transcript_json)
        except Exception:
            turns = []
        results.append(
            SavedInterviewReportSummary(
                id=r.id,
                session_id=r.session_id,
                interview_type=r.interview_type,
                experience_level=r.experience_level,
                role=r.role,
                company=r.company,
                location=r.location,
                score=r.score,
                feedback=r.feedback,
                transcript=[
                    TurnSchema(
                        role=t.get("role", "interviewer"),
                        content=t.get("content", ""),
                    )
                    for t in turns
                ],
                created_at=r.created_at.isoformat(),
            )
        )
    return results


@router.delete("/reports/{report_id}", response_model=DeleteInterviewReportResponse)
def delete_interview_report(
    report_id: int, db: Session = Depends(get_db)
) -> DeleteInterviewReportResponse:
    """Deletes a saved mock interview report by ID."""
    report = db.get(SavedInterviewReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Saved interview report not found.")

    db.delete(report)
    db.commit()
    return DeleteInterviewReportResponse(id=report_id)

