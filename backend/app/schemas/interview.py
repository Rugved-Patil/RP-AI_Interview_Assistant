"""
Request/response models for the mock interview endpoints.

Separate from schemas/session.py (which serves the Technical questions
mode) — same split as the session stores and route files.
"""

from __future__ import annotations

from pydantic import BaseModel, field_validator

from app.schemas.personalization import blank_optional_becomes_none, require_role
from app.schemas.session import Answer
from app.services.interview_store import ExperienceLevel, InterviewType


class StartInterviewRequest(BaseModel):
    """
    Configuration for a new mock interview (Option A — scope doc Phase 2).

    role/company/location come from the active preset (same as Technical
    questions). interview_type and experience_level are the two new
    fields the user picks at interview start.
    """

    interview_type: InterviewType
    experience_level: ExperienceLevel
    role: str
    company: str | None = None
    location: str | None = None

    @field_validator("role")
    @classmethod
    def _role_not_blank(cls, value: str) -> str:
        return require_role(value)

    @field_validator("company", "location")
    @classmethod
    def _optional_blank_to_none(cls, value: str | None) -> str | None:
        return blank_optional_becomes_none(value)


class StartInterviewResponse(BaseModel):
    session_id: str
    first_question: str


class InterviewAnswerRequest(BaseModel):
    """Same trim + length validation as Technical questions (reuses the Answer type)."""

    answer: Answer


class InterviewAnswerResponse(BaseModel):
    session_id: str
    interviewer_message: str | None  # next question, closing remark, or None (hard cap)
    interview_ended: bool
    turn_number: int  # number of Q/A pairs completed so far


class EndInterviewResponse(BaseModel):
    session_id: str
    status: str


class InterviewDimensions(BaseModel):
    technical_correctness: int
    depth_of_knowledge: int
    problem_solving: int
    communication: int
    practical_readiness: int


class InterviewGradeResponse(BaseModel):
    session_id: str
    score: int
    feedback: str
    dimensions: InterviewDimensions | None = None


class TurnSchema(BaseModel):
    role: str
    content: str


class SaveInterviewReportResponse(BaseModel):
    id: int
    session_id: str
    saved: bool = True


class DeleteInterviewReportResponse(BaseModel):
    id: int
    deleted: bool = True


class SavedInterviewReportSummary(BaseModel):
    id: int
    session_id: str
    interview_type: str
    experience_level: str
    role: str
    company: str | None = None
    location: str | None = None
    score: int
    feedback: str
    transcript: list[TurnSchema]
    created_at: str  # ISO string representation of datetime
    dimensions: InterviewDimensions | None = None
