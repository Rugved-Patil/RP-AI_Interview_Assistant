"""Request/response models for the saved-reports endpoints - the persistence
counterpart to schemas/session.py."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SaveReportResponse(BaseModel):
    id: int
    session_id: str
    saved: bool = True


class DeleteReportResponse(BaseModel):
    id: int
    deleted: bool = True


class ReportSummary(BaseModel):
    # from_attributes lets a SQLAlchemy model instance populate this directly
    # (ReportSummary.model_validate(report)) instead of unpacking fields by hand.
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    question: str
    answer: str
    score: int
    feedback: str
    created_at: datetime