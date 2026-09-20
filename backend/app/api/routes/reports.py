"""
Opt-in save + list endpoints for graded situational-practice reports
(scope doc Section 3.6: "a report is not saved automatically... the user
must explicitly opt in").

Deliberately its own file, same reasoning as sessions.py vs grading.py -
"grade an answer" and "persist a report to disk" are different concerns
even though both act on a session_id.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import SavedReport
from app.schemas.report import DeleteReportResponse, ReportSummary, SaveReportResponse
from app.services.session_store import get_session

router = APIRouter(tags=["reports"])


@router.post("/sessions/{session_id}/save", response_model=SaveReportResponse)
def save_report(session_id: str, db: Session = Depends(get_db)) -> SaveReportResponse:
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.score is None or session.feedback is None:
        raise HTTPException(status_code=400, detail="Session hasn't been graded yet")

    report = SavedReport(
        session_id=session.id,
        question=session.question,
        answer=session.answer or "",
        score=session.score,
        feedback=session.feedback,
        role=session.role,
        company=session.company,
        location=session.location,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        # session_id is UNIQUE - fires on a duplicate save (e.g. a double-
        # click). Treat as "already saved" rather than an error: the end
        # state the user wanted is already true.
        db.rollback()
        existing = db.scalar(select(SavedReport).where(SavedReport.session_id == session_id))
        return SaveReportResponse(id=existing.id, session_id=session_id)

    db.refresh(report)
    return SaveReportResponse(id=report.id, session_id=report.session_id)


@router.get("/reports", response_model=list[ReportSummary])
def list_reports(db: Session = Depends(get_db)) -> list[SavedReport]:
    """Most recent first - the natural order for "what have I practiced"."""
    return list(db.scalars(select(SavedReport).order_by(SavedReport.created_at.desc())))


@router.delete("/reports/{report_id}", response_model=DeleteReportResponse)
def delete_report(report_id: int, db: Session = Depends(get_db)) -> DeleteReportResponse:
    """
    Deletes by the report's own primary key, not session_id - the frontend
    already has `id` on every ReportSummary it's rendering, so there's no
    reason to route this through the session layer at all. Confirmation
    (if any) is a frontend concern; this endpoint just does the delete.
    """
    report = db.get(SavedReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    db.delete(report)
    db.commit()
    return DeleteReportResponse(id=report_id)