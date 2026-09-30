"""
Pydantic schemas for the Analytics and Progress Tracking engine (Phase 4).
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

from app.services.rag.models import QuestionDoc


class AnalyticsSummary(BaseModel):
    """Lifetime summary statistics across all saved sessions."""

    total_sessions: int = Field(0, description="Total number of saved sessions")
    total_single_drills: int = Field(0, description="Total single question drills")
    total_mock_interviews: int = Field(0, description="Total full mock interviews")
    average_score: float = Field(0.0, description="Overall average score (0-10)")
    highest_score: int | None = Field(None, description="Highest score achieved")
    lowest_score: int | None = Field(None, description="Lowest score achieved")
    recent_average: float | None = Field(None, description="Average score across last 5 sessions")
    score_trend: float = Field(0.0, description="Difference between recent and overall average score")
    single_average: float | None = Field(None, description="Average score for single drills")
    mock_average: float | None = Field(None, description="Average score for mock interviews")
    top_strength_domain: str | None = Field(None, description="Domain with highest average score")
    focus_domain: str | None = Field(None, description="Domain with lowest average score needing practice")


class ScoreDataPoint(BaseModel):
    """A single historical attempt data point on the score trajectory timeline."""

    id: int
    session_id: str
    date: str
    session_type: Literal["single_technical", "single_behavioral", "mock_technical", "mock_hr"]
    session_type_label: str
    role: str | None
    company: str | None
    score: int
    feedback_excerpt: str
    word_count: int


class DomainBreakdown(BaseModel):
    """Performance statistics for a specific domain/category."""

    domain: str
    category: Literal["technical", "behavioral", "general"]
    sessions_count: int
    average_score: float
    min_score: int
    max_score: int
    status: Literal["Strong", "Competent", "Needs Practice"]


class ScoreDistribution(BaseModel):
    """Histogram bucket counts for scores (0-10)."""

    mastered: int = Field(0, description="Scores 9-10")
    proficient: int = Field(0, description="Scores 7-8")
    developing: int = Field(0, description="Scores 5-6")
    needs_work: int = Field(0, description="Scores 0-4")


class WeakSpotItem(BaseModel):
    """Identified weak spot or topic gap."""

    domain: str
    topic: str
    average_score: float
    occurrences: int
    reasons: list[str] = Field(default_factory=list)


class CommunicationInsights(BaseModel):
    """Insights into candidate communication, answer length, and delivery."""

    avg_word_count: int = Field(0, description="Average words per single answer")
    conciseness_status: Literal["Concise", "Balanced", "Verbose", "Not Enough Data"] = "Not Enough Data"
    total_words_spoken_or_typed: int = 0
    common_strength_keywords: list[str] = Field(default_factory=list)
    common_growth_keywords: list[str] = Field(default_factory=list)


class RecommendedDrill(BaseModel):
    """A recommended question from the Question Bank targeted to a weak spot."""

    question_id: str
    question: str
    domain: str
    category: str
    difficulty: str
    tags: list[str] = Field(default_factory=list)
    reason: str


class AnalyticsDashboardResponse(BaseModel):
    """Full comprehensive analytics dashboard payload."""

    summary: AnalyticsSummary
    timeline: list[ScoreDataPoint] = Field(default_factory=list)
    domains: list[DomainBreakdown] = Field(default_factory=list)
    score_distribution: ScoreDistribution
    weak_spots: list[WeakSpotItem] = Field(default_factory=list)
    communication: CommunicationInsights
    recommended_drills: list[RecommendedDrill] = Field(default_factory=list)
