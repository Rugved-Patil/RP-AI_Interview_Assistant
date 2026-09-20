"""
ORM model for explicitly-saved interview reports (scope doc Section 3.6).

Deliberately a different class from PracticeSession (services/session_store.py)
and from the Pydantic schemas (schemas/*.py) - three different jobs:
  - PracticeSession: in-memory shape of an in-progress attempt
  - SavedReport (here): the on-disk row for a report the user opted to keep
  - Pydantic schemas: the shape of data crossing the HTTP boundary

Reusing one class for "DB row" and "API response" is a common early mistake -
keeping them separate means changing the wire format later doesn't force a
DB schema change, and vice versa.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    score: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[str] = mapped_column(Text)
    # The personalization context this answer was graded against, copied
    # from the PracticeSession at save time. Stored as plain text rather
    # than a link to an InterviewPreset row on purpose: a report is a
    # snapshot of what happened, and presets can be edited or deleted
    # later - a foreign key would make an old report's context change (or
    # vanish) along with the preset. Nullable because company/location are
    # optional inputs.
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class InterviewPreset(Base):
    """
    A saved role/company/location combo the user can select and reuse on
    the situational practice page, instead of retyping it per attempt.

    Deliberately its own table rather than reusing SavedReport's shape -
    a preset isn't a graded attempt at all, it's personalization *input*
    to future attempts. "Which preset is currently active" is NOT stored
    here: that's a browser-local concern (see frontend's activePreset.ts)
    rather than something worth persisting server-side, since it's a
    per-browser convenience, not data - see learnings-and-decisions.md.
    """

    __tablename__ = "interview_presets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String)
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )