"""
Analytics API endpoints (Phase 4).

Endpoints:
    GET /analytics         -> Full analytics dashboard metrics (summary, timeline, domains, weak spots, recommendations)
    GET /analytics/summary -> Lightweight lifetime summary statistics
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.schemas.analytics import AnalyticsDashboardResponse, AnalyticsSummary
from app.services.analytics import compute_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsDashboardResponse)
def get_analytics_dashboard(
    timeframe: int | None = Query(
        None, description="Filter timeframe in days (e.g., 7 or 30). Omit for all-time."
    ),
    session_type: Literal["all", "mock", "single"] = Query(
        "all", description="Filter by session type ('all', 'mock', 'single')"
    ),
    db: Session = Depends(get_db),
) -> AnalyticsDashboardResponse:
    """
    Returns the comprehensive analytics dashboard payload including historical score trajectory,
    domain competencies, weak spots, communication analysis, and targeted question bank recommendations.
    """
    return compute_analytics(db=db, timeframe_days=timeframe, filter_type=session_type)


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    db: Session = Depends(get_db),
) -> AnalyticsSummary:
    """
    Returns lightweight high-level summary metrics (total sessions, averages, trend).
    """
    dashboard = compute_analytics(db=db)
    return dashboard.summary
