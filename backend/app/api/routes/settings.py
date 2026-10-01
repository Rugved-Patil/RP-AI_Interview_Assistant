"""
Settings, system diagnostics, and data export/import endpoints.
"""

from __future__ import annotations

import csv
import io
import json
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import get_db
from app.db.models import InterviewPreset, SavedInterviewReport, SavedReport
from app.schemas.settings import (
    ClearDataRequest,
    ClearDataResponse,
    ExportDataResponse,
    ImportDataRequest,
    ImportDataResponse,
    ProviderVerificationResult,
    SettingsConfigResponse,
    VerifyConnectionsResponse,
)
from app.services.llm.base import Message, Role, LLMProviderError
from app.services.llm.factory import LLMRole, get_provider
from app.services.rag.retriever import get_rag_retriever
from app.services.session_store import clear_all_sessions
from app.services.interview_store import clear_all_interviews

router = APIRouter(tags=["settings"])


def _mask_key(key: str | None) -> str | None:
    if not key:
        return None
    key = key.strip()
    if len(key) <= 6:
        return "••••••"
    return f"{key[:3]}••••••••{key[-4:]}"


@router.get("/settings/config", response_model=SettingsConfigResponse)
def get_settings_config(db: Session = Depends(get_db)) -> SettingsConfigResponse:
    """Returns application configuration metadata, engine credentials status, and storage metrics."""
    settings = get_settings()

    total_single = db.scalar(select(func.count(SavedReport.id))) or 0
    total_mock = db.scalar(select(func.count(SavedInterviewReport.id))) or 0
    total_presets = db.scalar(select(func.count(InterviewPreset.id))) or 0

    rag_retriever = get_rag_retriever()
    rag_count = len(rag_retriever.vector_store.documents) if (rag_retriever and rag_retriever.vector_store) else 0

    return SettingsConfigResponse(
        app_name=settings.app_name,
        evaluator_configured=bool(settings.gemini_api_key.strip()),
        evaluator_key_preview=_mask_key(settings.gemini_api_key),
        interviewer_configured=bool(settings.groq_api_key.strip()),
        interviewer_key_preview=_mask_key(settings.groq_api_key),
        rag_enabled=settings.rag_enabled,
        rag_questions_count=rag_count,
        total_single_reports=int(total_single),
        total_mock_reports=int(total_mock),
        total_presets=int(total_presets),
    )


@router.post("/settings/verify", response_model=VerifyConnectionsResponse)
async def verify_engine_connections() -> VerifyConnectionsResponse:
    """
    Tests live connectivity to the assessment evaluation engine and interviewer engine.
    """
    settings = get_settings()

    # 1. Evaluator Engine check
    if not settings.gemini_api_key.strip():
        evaluator_res = ProviderVerificationResult(
            ok=False,
            message="Evaluator API key not configured in .env",
            provider="Diagnostic Assessment Engine",
        )
    else:
        try:
            eval_provider = get_provider(LLMRole.GRADER)
            start_t = time.perf_counter()
            # Send a micro verification ping
            await eval_provider.generate(
                messages=[Message(role=Role.USER, content="Ping. Respond with 'OK'.")],
                temperature=0.0,
                max_tokens=10,
            )
            elapsed = (time.perf_counter() - start_t) * 1000
            evaluator_res = ProviderVerificationResult(
                ok=True,
                message="Connected and operational",
                provider="Diagnostic Assessment Engine",
                latency_ms=round(elapsed, 1),
            )
        except LLMProviderError as exc:
            evaluator_res = ProviderVerificationResult(
                ok=False,
                message=f"Connection failed: {exc.message}",
                provider="Diagnostic Assessment Engine",
            )
        except Exception as exc:
            evaluator_res = ProviderVerificationResult(
                ok=False,
                message=f"Unexpected error: {str(exc)}",
                provider="Diagnostic Assessment Engine",
            )

    # 2. Interviewer Engine check
    if not settings.groq_api_key.strip():
        interviewer_res = ProviderVerificationResult(
            ok=False,
            message="Interviewer API key not configured in .env",
            provider="Interviewer Dialogue Engine",
        )
    else:
        try:
            interviewer_provider = get_provider(LLMRole.INTERVIEWER)
            start_t = time.perf_counter()
            await interviewer_provider.generate(
                messages=[Message(role=Role.USER, content="Ping. Respond with 'OK'.")],
                temperature=0.0,
                max_tokens=10,
            )
            elapsed = (time.perf_counter() - start_t) * 1000
            interviewer_res = ProviderVerificationResult(
                ok=True,
                message="Connected and operational",
                provider="Interviewer Dialogue Engine",
                latency_ms=round(elapsed, 1),
            )
        except LLMProviderError as exc:
            interviewer_res = ProviderVerificationResult(
                ok=False,
                message=f"Connection failed: {exc.message}",
                provider="Interviewer Dialogue Engine",
            )
        except Exception as exc:
            interviewer_res = ProviderVerificationResult(
                ok=False,
                message=f"Unexpected error: {str(exc)}",
                provider="Interviewer Dialogue Engine",
            )

    all_ok = evaluator_res.ok and interviewer_res.ok
    return VerifyConnectionsResponse(
        evaluator=evaluator_res,
        interviewer=interviewer_res,
        all_ok=all_ok,
    )


@router.get("/data/export")
def export_data(
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
) -> Any:
    """Exports all saved practice records, mock interviews, and presets as JSON or CSV."""
    single_reports = db.scalars(select(SavedReport).order_by(SavedReport.created_at.asc())).all()
    mock_reports = db.scalars(
        select(SavedInterviewReport).order_by(SavedInterviewReport.created_at.asc())
    ).all()
    presets = db.scalars(select(InterviewPreset).order_by(InterviewPreset.created_at.asc())).all()

    now_iso = datetime.now(timezone.utc).isoformat()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Record Type",
                "Session ID",
                "Created At (UTC)",
                "Role",
                "Company",
                "Location",
                "Interview/Question Type",
                "Experience Level",
                "Score",
                "Feedback Excerpt",
                "Content / Transcript",
            ]
        )

        for r in single_reports:
            writer.writerow(
                [
                    "Single Drill",
                    r.session_id,
                    r.created_at.isoformat() if r.created_at else "",
                    r.role or "",
                    r.company or "",
                    r.location or "",
                    "Situational / Technical",
                    "N/A",
                    r.score,
                    (r.feedback or "").replace("\n", " ")[:200],
                    f"Question: {r.question} | Answer: {r.answer}",
                ]
            )

        for m in mock_reports:
            writer.writerow(
                [
                    "Full Mock Interview",
                    m.session_id,
                    m.created_at.isoformat() if m.created_at else "",
                    m.role,
                    m.company or "",
                    m.location or "",
                    m.interview_type,
                    m.experience_level,
                    m.score,
                    (m.feedback or "").replace("\n", " ")[:200],
                    m.transcript_json,
                ]
            )

        csv_content = output.getvalue()
        return PlainTextResponse(
            csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="interview_reports_{now_iso[:10]}.csv"'},
        )

    # Default JSON export format
    data = {
        "version": "1.0",
        "exported_at": now_iso,
        "saved_reports": [
            {
                "session_id": r.session_id,
                "question": r.question,
                "answer": r.answer,
                "score": r.score,
                "feedback": r.feedback,
                "role": r.role,
                "company": r.company,
                "location": r.location,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in single_reports
        ],
        "saved_interview_reports": [
            {
                "session_id": m.session_id,
                "interview_type": m.interview_type,
                "experience_level": m.experience_level,
                "role": m.role,
                "company": m.company,
                "location": m.location,
                "score": m.score,
                "feedback": m.feedback,
                "transcript_json": m.transcript_json,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in mock_reports
        ],
        "presets": [
            {
                "role": p.role,
                "company": p.company,
                "location": p.location,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in presets
        ],
    }

    return ExportDataResponse(**data)


@router.post("/data/import", response_model=ImportDataResponse)
def import_data(body: ImportDataRequest, db: Session = Depends(get_db)) -> ImportDataResponse:
    """
    Imports saved reports and presets from a JSON backup without duplicating existing session IDs.
    """
    imported_single = 0
    imported_mock = 0
    imported_presets = 0

    if body.saved_reports:
        for item in body.saved_reports:
            sid = item.get("session_id")
            if not sid:
                continue
            exists = db.scalar(select(SavedReport).where(SavedReport.session_id == sid))
            if not exists:
                created_dt = None
                if item.get("created_at"):
                    try:
                        created_dt = datetime.fromisoformat(item["created_at"])
                    except Exception:
                        created_dt = None
                report = SavedReport(
                    session_id=sid,
                    question=item.get("question", ""),
                    answer=item.get("answer", ""),
                    score=int(item.get("score", 0)),
                    feedback=item.get("feedback", ""),
                    role=item.get("role"),
                    company=item.get("company"),
                    location=item.get("location"),
                )
                if created_dt:
                    report.created_at = created_dt
                db.add(report)
                imported_single += 1

    if body.saved_interview_reports:
        for item in body.saved_interview_reports:
            sid = item.get("session_id")
            if not sid:
                continue
            exists = db.scalar(
                select(SavedInterviewReport).where(SavedInterviewReport.session_id == sid)
            )
            if not exists:
                created_dt = None
                if item.get("created_at"):
                    try:
                        created_dt = datetime.fromisoformat(item["created_at"])
                    except Exception:
                        created_dt = None
                t_json = item.get("transcript_json", "[]")
                if not isinstance(t_json, str):
                    t_json = json.dumps(t_json)
                mock = SavedInterviewReport(
                    session_id=sid,
                    interview_type=item.get("interview_type", "technical"),
                    experience_level=item.get("experience_level", "junior"),
                    role=item.get("role", "Software Engineer"),
                    company=item.get("company"),
                    location=item.get("location"),
                    score=int(item.get("score", 0)),
                    feedback=item.get("feedback", ""),
                    transcript_json=t_json,
                )
                if created_dt:
                    mock.created_at = created_dt
                db.add(mock)
                imported_mock += 1

    if body.presets:
        for item in body.presets:
            role = item.get("role")
            if not role:
                continue
            preset = InterviewPreset(
                role=role,
                company=item.get("company"),
                location=item.get("location"),
            )
            db.add(preset)
            imported_presets += 1

    db.commit()

    total = imported_single + imported_mock + imported_presets
    return ImportDataResponse(
        imported_single_reports=imported_single,
        imported_mock_reports=imported_mock,
        imported_presets=imported_presets,
        total_imported=total,
        message=f"Successfully restored {total} items ({imported_single} single drills, {imported_mock} mock interviews, {imported_presets} presets).",
    )


@router.post("/data/clear", response_model=ClearDataResponse)
def clear_data(body: ClearDataRequest, db: Session = Depends(get_db)) -> ClearDataResponse:
    """Clears chosen tables and in-memory caches."""
    cleared_single = 0
    cleared_mock = 0
    cleared_presets = 0

    if body.clear_all or body.clear_single_reports:
        reports = db.scalars(select(SavedReport)).all()
        cleared_single = len(reports)
        for r in reports:
            db.delete(r)

    if body.clear_all or body.clear_mock_reports:
        mocks = db.scalars(select(SavedInterviewReport)).all()
        cleared_mock = len(mocks)
        for m in mocks:
            db.delete(m)

    if body.clear_all or body.clear_presets:
        presets = db.scalars(select(InterviewPreset)).all()
        cleared_presets = len(presets)
        for p in presets:
            db.delete(p)

    db.commit()

    # Clear in-memory session caches as well
    clear_all_sessions()
    clear_all_interviews()

    return ClearDataResponse(
        cleared_single_reports=cleared_single,
        cleared_mock_reports=cleared_mock,
        cleared_presets=cleared_presets,
        message="Selected application data and session caches have been cleared.",
    )
