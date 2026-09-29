"""
Request/response models for the mock interview endpoints.

Separate from schemas/session.py (which serves the Technical questions
mode) — same split as the session stores and route files.
"""

from __future__ import annotations

from pydantic import BaseModel, field_validator

from app.schemas.personalization import blank_optional_becomes_none, require_role
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
