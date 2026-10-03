"""
Unit and integration tests for Analytics and Progress Tracking (Phase 4).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base, get_db
from app.db.models import SavedInterviewReport, SavedReport
from app.main import app
from app.services.analytics import compute_analytics


# Isolated in-memory SQLite fixture for test runs
@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(test_db: Session):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_analytics_empty_db(test_db: Session, client: TestClient):
    """Test analytics when no reports are saved yet."""
    analytics = compute_analytics(test_db)
    assert analytics.summary.total_sessions == 0
    assert analytics.summary.average_score == 0.0
    assert analytics.summary.highest_score is None
    assert analytics.summary.lowest_score is None
    assert analytics.summary.score_trend == 0.0
    assert len(analytics.timeline) == 0
    assert len(analytics.domains) == 0
    assert analytics.communication.avg_word_count == 0

    # API test
    res = client.get("/analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_sessions"] == 0
    assert data["summary"]["average_score"] == 0.0

    summary_res = client.get("/analytics/summary")
    assert summary_res.status_code == 200
    assert summary_res.json()["total_sessions"] == 0


def test_analytics_single_reports_aggregation(test_db: Session):
    """Test analytics calculation with single question drill reports."""
    now = datetime.now(timezone.utc)
    report1 = SavedReport(
        session_id="sess-001",
        question="Explain how React Fiber works and why keys are necessary.",
        answer="React Fiber is a reconciliation engine that allows incremental rendering... " * 10,
        score=8,
        feedback="Clear explanation of the virtual DOM and key reconciliation.",
        role="Frontend Engineer",
        company="Airbnb",
        location="Remote",
        created_at=now - timedelta(days=2),
    )
    report2 = SavedReport(
        session_id="sess-002",
        question="How do you handle race conditions in distributed payment systems?",
        answer="Use idempotency keys, distributed locks, and database transactions.",
        score=6,
        feedback="Good start but missed details on two-phase commits and trade-offs.",
        role="Backend Engineer",
        company="Stripe",
        location="San Francisco",
        created_at=now - timedelta(days=1),
    )
    test_db.add_all([report1, report2])
    test_db.commit()

    analytics = compute_analytics(test_db)
    assert analytics.summary.total_sessions == 2
    assert analytics.summary.total_single_drills == 2
    assert analytics.summary.total_mock_interviews == 0
    assert analytics.summary.average_score == 7.0
    assert analytics.summary.highest_score == 8
    assert analytics.summary.lowest_score == 6
    assert len(analytics.timeline) == 2

    # Verify domain breakdown
    domains = {d.domain: d for d in analytics.domains}
    assert "Frontend" in domains or "Software Engineering" in domains
    assert analytics.communication.avg_word_count > 0


def test_analytics_mock_interview_aggregation(test_db: Session):
    """Test analytics computation with saved multi-turn mock interview reports."""
    now = datetime.now(timezone.utc)
    transcript_hr = [
        {"role": "interviewer", "content": "Tell me about a time you resolved a conflict."},
        {"role": "candidate", "content": "In my previous role, our team had a disagreement regarding database migration. I scheduled a sync to evaluate pros and cons and align on a decision."},
        {"role": "interviewer", "content": "What was the outcome?"},
        {"role": "candidate", "content": "We delivered the migration on schedule with zero downtime."},
    ]
    report_hr = SavedInterviewReport(
        session_id="mock-hr-001",
        interview_type="hr",
        experience_level="mid",
        role="Engineering Manager",
        company="Google",
        location="New York",
        score=9,
        feedback="Excellent STAR format responses, clear leadership and conflict resolution.",
        transcript_json=json.dumps(transcript_hr),
        created_at=now - timedelta(days=3),
    )

    transcript_tech = [
        {"role": "interviewer", "content": "How would you design a URL shortener?"},
        {"role": "candidate", "content": "I would use Base62 encoding, a distributed ID generator or Snowflake, Redis caching, and Cassandra or Postgres for storage."},
    ]
    report_tech = SavedInterviewReport(
        session_id="mock-tech-001",
        interview_type="technical",
        experience_level="senior",
        role="System Architect",
        company="Amazon",
        location="Seattle",
        score=7,
        feedback="Solid design overview. Could elaborate more on cache eviction and partition sharding.",
        transcript_json=json.dumps(transcript_tech),
        created_at=now - timedelta(days=1),
    )

    test_db.add_all([report_hr, report_tech])
    test_db.commit()

    analytics = compute_analytics(test_db)
    assert analytics.summary.total_sessions == 2
    assert analytics.summary.total_mock_interviews == 2
    assert analytics.summary.total_single_drills == 0
    assert analytics.summary.average_score == 8.0
    assert analytics.summary.mock_average == 8.0

    hr_domain = next((d for d in analytics.domains if d.domain == "Behavioral & HR"), None)
    assert hr_domain is not None
    assert hr_domain.average_score == 9.0


def test_analytics_mixed_sessions_and_trajectory(test_db: Session):
    """Test score trajectory and trend calculations with mixed sessions."""
    now = datetime.now(timezone.utc)
    # Create 6 sessions to test recent_average and score_trend
    scores = [5, 6, 7, 8, 8, 9]
    for i, s in enumerate(scores):
        rep = SavedReport(
            session_id=f"mixed-sess-{i}",
            question=f"Question {i} about engineering systems",
            answer="Answer content here with several descriptive words.",
            score=s,
            feedback="Good effort and structured response.",
            role="Backend Engineer",
            company="Netflix",
            location="Remote",
            created_at=now - timedelta(days=10 - i),
        )
        test_db.add(rep)
    test_db.commit()

    analytics = compute_analytics(test_db)
    assert analytics.summary.total_sessions == 6
    # Overall average: sum(5..9)/6 = 43/6 = 7.166 -> 7.2
    assert analytics.summary.average_score == 7.2
    assert analytics.summary.highest_score == 9
    assert analytics.summary.lowest_score == 5
    # Recent average (last 5): sum(6,7,8,8,9)/5 = 38/5 = 7.6
    assert analytics.summary.recent_average == 7.6
    # Trend: 7.6 - 7.2 = +0.4
    assert analytics.summary.score_trend == 0.4
    assert len(analytics.timeline) == 6
    # Score distribution
    assert analytics.score_distribution.mastered == 1  # 9
    assert analytics.score_distribution.proficient == 3  # 7, 8, 8
    assert analytics.score_distribution.developing == 2  # 5, 6
    assert analytics.score_distribution.needs_work == 0


def test_analytics_filtering_by_timeframe_and_type(test_db: Session):
    """Test timeframe and session_type query filters."""
    now = datetime.now(timezone.utc)
    old_single = SavedReport(
        session_id="old-001",
        question="Old question",
        answer="Old answer",
        score=5,
        feedback="Old feedback",
        role="Backend",
        created_at=now - timedelta(days=40),
    )
    new_single = SavedReport(
        session_id="new-001",
        question="New question",
        answer="New answer",
        score=9,
        feedback="New feedback",
        role="Backend",
        created_at=now - timedelta(days=2),
    )
    new_mock = SavedInterviewReport(
        session_id="mock-002",
        interview_type="hr",
        experience_level="mid",
        role="HR",
        company="Meta",
        location="NY",
        score=8,
        feedback="HR feedback",
        transcript_json="[]",
        created_at=now - timedelta(days=1),
    )
    test_db.add_all([old_single, new_single, new_mock])
    test_db.commit()

    # All time
    all_res = compute_analytics(test_db)
    assert all_res.summary.total_sessions == 3

    # Last 30 days
    recent_res = compute_analytics(test_db, timeframe_days=30)
    assert recent_res.summary.total_sessions == 2
    assert recent_res.summary.lowest_score == 8

    # Filter by mock only
    mock_res = compute_analytics(test_db, filter_type="mock")
    assert mock_res.summary.total_sessions == 1
    assert mock_res.summary.total_mock_interviews == 1

    # Filter by single only
    single_res = compute_analytics(test_db, filter_type="single")
    assert single_res.summary.total_sessions == 2
    assert single_res.summary.total_single_drills == 2


def test_analytics_recommended_drills_generation(test_db: Session):
    """Test that weak spots generate curated recommendations with 8/10 model answers from the question bank."""
    now = datetime.now(timezone.utc)
    # Low score in DevOps
    report_devops = SavedReport(
        session_id="devops-weak",
        question="How do you manage Kubernetes cluster networking and ingress controllers?",
        answer="I don't know much about kubernetes ingress controllers.",
        score=4,
        feedback="Lacks understanding of ingress routing, service meshes, and CIDR blocks.",
        role="DevOps Engineer",
        created_at=now,
    )
    test_db.add(report_devops)
    test_db.commit()

    analytics = compute_analytics(test_db)
    assert len(analytics.weak_spots) >= 1
    assert len(analytics.recommended_drills) > 0
    # 1 session completed -> not unlocked yet (needs 2 more)
    assert analytics.summary.training_unlocked is False
    assert analytics.summary.sessions_until_unlock == 2

    # Recommended drill should have question text, id, model answer, and scoring breakdown
    first_rec = analytics.recommended_drills[0]
    assert first_rec.question_id is not None
    assert len(first_rec.question) > 10
    assert len(first_rec.model_answer) > 20
    assert len(first_rec.scoring_breakdown) > 20
    assert first_rec.recommended_test_type in ("single_drill", "behavioral_drill", "mock_interview")


def test_analytics_api_endpoints(client: TestClient, test_db: Session):
    """Test full HTTP API routes for analytics."""
    report = SavedReport(
        session_id="api-sess-1",
        question="Explain dynamic programming memoization.",
        answer="Memoization caches previously computed subproblem outputs in an array or hash map.",
        score=9,
        feedback="Very clear explanation.",
        role="Software Engineer",
        created_at=datetime.now(timezone.utc),
    )
    test_db.add(report)
    test_db.commit()

    res = client.get("/analytics?timeframe=30&session_type=all")
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["total_sessions"] == 1
    assert data["summary"]["average_score"] == 9.0
    assert len(data["timeline"]) == 1
    assert data["score_distribution"]["mastered"] == 1

    sum_res = client.get("/analytics/summary")
    assert sum_res.status_code == 200
    assert sum_res.json()["total_sessions"] == 1
    assert sum_res.json()["average_score"] == 9.0
