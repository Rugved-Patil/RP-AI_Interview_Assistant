"""
Sandbox API routes for live code execution and AI-assisted code grading.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import SavedReport
from app.schemas.report import SaveReportResponse
from app.schemas.sandbox import (
    CodingProblem,
    CodingProblemSummary,
    GradeCodeRequest,
    GradeCodeResponse,
    RunCodeRequest,
    RunCodeResponse,
    SaveCodingReportRequest,
)
from app.services.code_runner import (
    get_coding_problem,
    grade_code_submission,
    list_coding_problems,
    run_code_in_sandbox,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


@router.get("/problems", response_model=list[CodingProblemSummary])
def get_problems(
    domain: str | None = Query(None, description="Optional domain filter"),
    difficulty: str | None = Query(None, description="Optional difficulty filter (junior/mid/senior/lead)"),
) -> list[CodingProblemSummary]:
    """Lists all available coding sandbox challenges."""
    return list_coding_problems(domain=domain, difficulty=difficulty)


@router.get("/problems/{problem_id}", response_model=CodingProblem)
def get_problem(problem_id: str) -> CodingProblem:
    """Retrieves full details, examples, starter code, and test cases for a coding problem."""
    problem = get_coding_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail=f"Coding problem '{problem_id}' not found")
    return problem


@router.post("/run", response_model=RunCodeResponse)
def run_code(req: RunCodeRequest) -> RunCodeResponse:
    """Executes candidate code against test cases in an isolated sandbox."""
    try:
        return run_code_in_sandbox(req)
    except Exception as exc:
        logger.exception("Failed to execute code in sandbox")
        raise HTTPException(status_code=500, detail=f"Sandbox execution error: {exc}")


@router.post("/grade", response_model=GradeCodeResponse)
async def grade_code(req: GradeCodeRequest) -> GradeCodeResponse:
    """Evaluates candidate code submission using Gemini AI diagnostic code assessment."""
    try:
        return await grade_code_submission(req)
    except Exception as exc:
        logger.exception("Failed to grade code submission")
        raise HTTPException(status_code=500, detail=f"Code grading error: {exc}")


@router.post("/save", response_model=SaveReportResponse)
def save_coding_report(
    req: SaveCodingReportRequest,
    db: Session = Depends(get_db),
) -> SaveReportResponse:
    """Persists a graded coding challenge submission to the saved reports repository for progress tracking and analytics."""
    try:
        session_id = f"coding-{req.problem_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        question_text = f"Coding Problem: {req.problem_title} ({req.domain})\nLanguage: {req.language.value.title()}\nTarget Big-O: Time {req.time_complexity} | Space {req.space_complexity}"
        formatted_feedback = f"### Algorithmic Complexity\n- **Time Complexity:** `{req.time_complexity}`\n- **Space Complexity:** `{req.space_complexity}`\n\n{req.feedback_markdown}"

        report = SavedReport(
            session_id=session_id,
            question=question_text,
            answer=req.code,
            score=req.score,
            feedback=formatted_feedback,
            role=req.domain,
            company="Coding Sandbox",
            location=req.language.value.title(),
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return SaveReportResponse(id=report.id, session_id=report.session_id)
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to save coding report")
        raise HTTPException(status_code=500, detail=f"Failed to save coding report: {exc}")

