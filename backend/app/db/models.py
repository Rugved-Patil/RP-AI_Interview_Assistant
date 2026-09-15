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
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )