"""
Sandbox API routes for live code execution and AI-assisted code grading.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query

from app.schemas.sandbox import (
    CodingProblem,
    CodingProblemSummary,
    GradeCodeRequest,
    GradeCodeResponse,
    RunCodeRequest,
    RunCodeResponse,
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
