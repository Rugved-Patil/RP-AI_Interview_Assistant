"""
In-memory store for mock interview sessions.

Separate from session_store.py (which holds TechnicalSession instances)
because the mock interview has its own class, lifecycle, and transcript
shape — per the scope doc's Phase 2 design decision (Section 7.1):
"InterviewSession sits beside TechnicalSession instead of generalizing
one session type with a kind field."

Same trade-off as session_store.py: restarting the backend loses any
in-progress interview. That's accepted (scope doc 7.1/7.2).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum


class InterviewType(str, Enum):
    HR = "hr"
    TECHNICAL = "technical"


class ExperienceLevel(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"


class InterviewStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    GRADED = "graded"


@dataclass
class Turn:
    """One turn in the interview conversation."""

    role: str  # "interviewer" or "candidate"
    content: str


@dataclass
class InterviewSession:
    """
    A full mock interview session: configuration, running transcript, and
    status.

    Scope doc Section 3.1 / 3.5: the AI conducts a full back-and-forth
    conversation as an interviewer, with follow-ups based on the user's
    answers. The transcript is the full conversation history, resent to
    the LLM on every turn so it can generate contextual follow-ups.

    role/company/location come from the active preset (Option A — no DB
    changes). interview_type and experience_level are provided at
    interview start.

    system_prompt is stored here (not rebuilt each turn) so the turn
    loop can prepend it to the transcript without re-importing the prompt
    builder, and so every turn in one interview uses the exact same prompt.
    """

    id: str
    interview_type: InterviewType
    experience_level: ExperienceLevel
    role: str
    system_prompt: str
    company: str | None = None
    location: str | None = None
    status: InterviewStatus = InterviewStatus.IN_PROGRESS
    transcript: list[Turn] = field(default_factory=list)
    score: int | None = None
    feedback: str | None = None
    dimensions: dict[str, int] | None = None


# Process-lifetime storage, same pattern as session_store._sessions.
_interviews: dict[str, InterviewSession] = {}


def create_interview(
    interview_type: InterviewType,
    experience_level: ExperienceLevel,
    role: str,
    system_prompt: str,
    company: str | None = None,
    location: str | None = None,
) -> InterviewSession:
    session = InterviewSession(
        id=str(uuid.uuid4()),
        interview_type=interview_type,
        experience_level=experience_level,
        role=role,
        system_prompt=system_prompt,
        company=company,
        location=location,
    )
    _interviews[session.id] = session
    return session


def get_interview(session_id: str) -> InterviewSession | None:
    return _interviews.get(session_id)


def clear_all_interviews() -> None:
    _interviews.clear()

