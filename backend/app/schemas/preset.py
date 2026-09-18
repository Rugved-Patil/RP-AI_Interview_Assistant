"""
Request/response models for the saved-presets endpoints.

Presets are the persisted, reusable form of the same role/company/
location personalization CreateSessionRequest (schemas/session.py)
validates - saved once, then selected and reused on the situational
practice page rather than retyped per attempt.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.personalization import blank_optional_becomes_none, require_role


class PresetIn(BaseModel):
    """
    Shared request shape for both creating and editing a preset - an edit
    is "the same fields, applied to an existing row," not a different
    shape needing its own rules, so create and update both take this.
    """

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


class PresetSummary(BaseModel):
    # from_attributes lets a SQLAlchemy model instance populate this
    # directly (PresetSummary.model_validate(preset)), same convention as
    # ReportSummary in schemas/report.py.
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    company: str | None
    location: str | None
    created_at: datetime


class DeletePresetResponse(BaseModel):
    id: int
    deleted: bool = True