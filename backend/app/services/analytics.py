"""
Analytics computation service for Phase 4: Advanced Analytics & Progress Tracking.

Aggregates historical data across:
  - SavedReport (single situational/behavioral practice questions)
  - SavedInterviewReport (full multi-turn mock interviews)

Generates:
  - Lifetime progress metrics & score trajectory
  - Domain competency breakdown
  - Weak-spot / gap analysis
  - Communication & delivery metrics
  - Targeted question recommendations from RAG Question Bank
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import SavedInterviewReport, SavedReport
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsSummary,
    CommunicationInsights,
    DomainBreakdown,
    RecommendedDrill,
    ScoreDataPoint,
    ScoreDistribution,
    WeakSpotItem,
)
from app.services.rag import get_rag_retriever


# Domain heuristic keywords
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "Frontend": ["frontend", "react", "vue", "angular", "css", "html", "dom", "javascript", "typescript", "ui", "ux", "browser", "state management", "webpack", "vite", "tailwind"],
    "Machine Learning & AI": ["machine learning", "ml", "ai", "llm", "neural", "deep learning", "transformer", "embedding", "rag", "nlp", "computer vision", "overfitting", "gradient", "loss function", "fine-tuning"],
    "System Design": ["system design", "scalability", "distributed", "load balancer", "sharding", "replication", "microservices", "cap theorem", "caching", "message queue", "kafka", "rabbitmq", "throughput", "latency"],
    "DevOps & Cloud": ["devops", "cloud", "aws", "gcp", "azure", "kubernetes", "k8s", "docker", "ci/cd", "terraform", "infrastructure", "ansible", "monitoring", "prometheus", "sre"],
    "Data Structures & Algorithms": ["algorithm", "data structure", "binary search", "tree", "graph", "dynamic programming", "dfs", "bfs", "hash table", "linked list", "sorting", "complexity", "big o", "leetcode"],
    "Behavioral & HR": ["behavioral", "star", "conflict", "leadership", "teamwork", "situation", "task", "action", "result", "disagreement", "challenge", "failure", "stakeholder", "deadline", "motivation", "culture fit", "hr"],
}


def _infer_domain(
    role: str | None,
    question: str,
    feedback: str = "",
    is_hr: bool = False,
) -> tuple[str, Literal["technical", "behavioral", "general"]]:
    """Infers the domain and category from context text."""
    if is_hr:
        return "Behavioral & HR", "behavioral"

    text = f"{role or ''} {question} {feedback}".lower()

    # Check behavioral hints in text
    if any(k in text for k in ["tell me about a time", "describe a situation", "give an example of when", "how did you handle", "how do you resolve conflict"]):
        return "Behavioral & HR", "behavioral"

    # Match domain keywords
    best_domain = "Software Engineering"
    max_matches = 0

    for domain, kws in DOMAIN_KEYWORDS.items():
        matches = sum(1 for kw in kws if kw in text)
        if matches > max_matches:
            max_matches = matches
            best_domain = domain

    category: Literal["technical", "behavioral", "general"] = (
        "behavioral" if best_domain == "Behavioral & HR" else "technical"
    )
    return best_domain, category


def _extract_feedback_keywords(feedback_texts: list[str]) -> tuple[list[str], list[str]]:
    """Extracts frequent strengths and growth theme keywords from qualitative feedback."""
    strength_themes = [
        "Structured Explanation",
        "Clear Technical Depth",
        "Good Real-World Examples",
        "Strong System Architecture",
        "Edge-Case Awareness",
        "Proactive Communication",
        "SOLID Principles",
        "Concise Delivery",
    ]
    growth_themes = [
        "Deeper Trade-Off Analysis",
        "More Concrete Metrics / Numbers",
        "STAR Method Structure",
        "Handling Failure Modes",
        "Explaining Alternative Approaches",
        "Conciseness & Brevity",
        "Specific Code / Algorithm Details",
        "Stakeholder Impact Articulation",
    ]

    combined = " ".join(feedback_texts).lower()

    active_strengths: list[str] = []
    active_growths: list[str] = []

    # Heuristics based on text signals
    if "structure" in combined or "clear" in combined or "well" in combined:
        active_strengths.append("Structured Explanation")
    if "depth" in combined or "thorough" in combined or "detailed" in combined:
        active_strengths.append("Clear Technical Depth")
    if "example" in combined or "scenario" in combined:
        active_strengths.append("Good Real-World Examples")
    if "edge" in combined or "scale" in combined:
        active_strengths.append("Edge-Case Awareness")

    if "trade-off" in combined or "tradeoff" in combined or "alternative" in combined:
        active_growths.append("Deeper Trade-Off Analysis")
    if "star" in combined or "action" in combined or "result" in combined:
        active_growths.append("STAR Method Structure")
    if "specific" in combined or "metric" in combined or "quantif" in combined:
        active_growths.append("More Concrete Metrics / Numbers")
    if "concise" in combined or "verbose" in combined or "rambl" in combined:
        active_growths.append("Conciseness & Brevity")
    if "fail" in combined or "error" in combined or "bottleneck" in combined:
        active_growths.append("Handling Failure Modes")

    if not active_strengths:
        active_strengths = strength_themes[:3]
    if not active_growths:
        active_growths = growth_themes[:3]

    return active_strengths[:4], active_growths[:4]


def compute_analytics(
    db: Session,
    timeframe_days: int | None = None,
    filter_type: Literal["all", "mock", "single"] = "all",
) -> AnalyticsDashboardResponse:
    """
    Computes aggregated performance metrics and progress trajectory across all saved reports.
    """
    # 1. Fetch saved single reports
    single_reports = list(
        db.scalars(select(SavedReport).order_by(SavedReport.created_at.asc()))
    )

    # 2. Fetch saved mock interview reports
    mock_reports = list(
        db.scalars(select(SavedInterviewReport).order_by(SavedInterviewReport.created_at.asc()))
    )

    # Filter by timeframe if requested
    cutoff = None
    if timeframe_days is not None:
        from datetime import timezone
        cutoff = datetime.now(timezone.utc).timestamp() - (timeframe_days * 86400)

    # Unified chronological timeline items
    timeline_items: list[ScoreDataPoint] = []
    all_scores: list[int] = []
    single_scores: list[int] = []
    mock_scores: list[int] = []
    domain_scores_map: dict[str, list[int]] = {}
    domain_category_map: dict[str, Literal["technical", "behavioral", "general"]] = {}
    feedback_corpus: list[str] = []
    total_words = 0
    single_answer_word_counts: list[int] = []

    # Process Single Reports
    if filter_type in ("all", "single"):
        for r in single_reports:
            if cutoff and r.created_at.timestamp() < cutoff:
                continue

            words = len(r.answer.split()) if r.answer else 0
            total_words += words
            if words > 0:
                single_answer_word_counts.append(words)

            all_scores.append(r.score)
            single_scores.append(r.score)
            feedback_corpus.append(r.feedback)

            # Determine domain & type
            domain, cat = _infer_domain(r.role, r.question, r.feedback, is_hr=False)
            domain_scores_map.setdefault(domain, []).append(r.score)
            domain_category_map[domain] = cat

            stype: Literal["single_technical", "single_behavioral", "mock_technical", "mock_hr"] = (
                "single_behavioral" if cat == "behavioral" else "single_technical"
            )
            slabel = "Single Behavioral Drill" if cat == "behavioral" else "Single Technical Drill"

            feedback_snippet = (
                (r.feedback[:140] + "...") if len(r.feedback) > 140 else r.feedback
            )

            timeline_items.append(
                ScoreDataPoint(
                    id=r.id,
                    session_id=r.session_id,
                    date=r.created_at.strftime("%Y-%m-%d %H:%M"),
                    session_type=stype,
                    session_type_label=slabel,
                    role=r.role or "General Engineer",
                    company=r.company,
                    score=r.score,
                    feedback_excerpt=feedback_snippet,
                    word_count=words,
                )
            )

    # Process Mock Reports
    if filter_type in ("all", "mock"):
        for m in mock_reports:
            if cutoff and m.created_at.timestamp() < cutoff:
                continue

            # Calculate word count from transcript candidate turns
            m_words = 0
            turn_count = 0
            try:
                turns = json.loads(m.transcript_json)
                for t in turns:
                    if t.get("role") == "candidate":
                        c_words = len(t.get("content", "").split())
                        m_words += c_words
                        turn_count += 1
            except Exception:
                pass

            total_words += m_words
            all_scores.append(m.score)
            mock_scores.append(m.score)
            feedback_corpus.append(m.feedback)

            is_hr = m.interview_type == "hr"
            domain, cat = _infer_domain(
                m.role,
                f"Mock interview for {m.role}",
                m.feedback,
                is_hr=is_hr,
            )
            domain_scores_map.setdefault(domain, []).append(m.score)
            domain_category_map[domain] = cat

            stype = "mock_hr" if is_hr else "mock_technical"
            slabel = "Full HR Mock Interview" if is_hr else "Full Technical Mock"

            feedback_snippet = (
                (m.feedback[:140] + "...") if len(m.feedback) > 140 else m.feedback
            )

            timeline_items.append(
                ScoreDataPoint(
                    id=m.id,
                    session_id=m.session_id,
                    date=m.created_at.strftime("%Y-%m-%d %H:%M"),
                    session_type=stype,
                    session_type_label=slabel,
                    role=m.role or "Candidate",
                    company=m.company,
                    score=m.score,
                    feedback_excerpt=feedback_snippet,
                    word_count=m_words,
                )
            )

    # Sort timeline chronologically
    timeline_items.sort(key=lambda x: x.date)

    # Summary calculations
    total_count = len(all_scores)
    avg_score = round(sum(all_scores) / total_count, 1) if total_count > 0 else 0.0
    highest = max(all_scores) if total_count > 0 else None
    lowest = min(all_scores) if total_count > 0 else None

    recent_slice = all_scores[-5:] if total_count >= 5 else all_scores
    recent_avg = round(sum(recent_slice) / len(recent_slice), 1) if recent_slice else None
    score_trend = round(recent_avg - avg_score, 1) if (recent_avg is not None and total_count > 0) else 0.0

    single_avg = (
        round(sum(single_scores) / len(single_scores), 1) if single_scores else None
    )
    mock_avg = (
        round(sum(mock_scores) / len(mock_scores), 1) if mock_scores else None
    )

    # Score distribution histogram
    score_distribution = ScoreDistribution(
        mastered=sum(1 for s in all_scores if s >= 9),
        proficient=sum(1 for s in all_scores if 7 <= s <= 8),
        developing=sum(1 for s in all_scores if 5 <= s <= 6),
        needs_work=sum(1 for s in all_scores if s <= 4),
    )

    # Domain Breakdown
    domains_list: list[DomainBreakdown] = []
    top_strength: str | None = None
    focus_domain: str | None = None

    for domain, scores in domain_scores_map.items():
        d_avg = round(sum(scores) / len(scores), 1)
        status: Literal["Strong", "Competent", "Needs Practice"] = (
            "Strong" if d_avg >= 8.0 else ("Competent" if d_avg >= 6.5 else "Needs Practice")
        )
        domains_list.append(
            DomainBreakdown(
                domain=domain,
                category=domain_category_map.get(domain, "technical"),
                sessions_count=len(scores),
                average_score=d_avg,
                min_score=min(scores),
                max_score=max(scores),
                status=status,
            )
        )

    # Sort domains by average score descending
    domains_list.sort(key=lambda d: d.average_score, reverse=True)

    if domains_list:
        top_strength = domains_list[0].domain
        # Focus domain is the lowest-scoring one with at least 1 session
        focus_domain = domains_list[-1].domain if domains_list[-1].average_score < 8.0 else None

    # Weak-Spots Detection (Competency Gap Analysis)
    weak_spots: list[WeakSpotItem] = []
    for d in domains_list:
        if d.average_score < 7.5 or d.status == "Needs Practice":
            reasons = []
            if d.average_score < 6.0:
                reasons.append("Frequent technical inaccuracies or incomplete solutions")
            if d.min_score <= 5:
                reasons.append("Score dips observed on high-difficulty questions")
            reasons.append("Needs deeper trade-off comparisons and concrete examples")
            weak_spots.append(
                WeakSpotItem(
                    domain=d.domain,
                    topic=f"{d.domain} Fundamentals & Edge Cases",
                    average_score=d.average_score,
                    occurrences=d.sessions_count,
                    reasons=reasons,
                )
            )

    # Communication Metrics
    avg_words = (
        round(sum(single_answer_word_counts) / len(single_answer_word_counts))
        if single_answer_word_counts
        else 0
    )
    conciseness_status: Literal["Concise", "Balanced", "Verbose", "Not Enough Data"] = (
        "Not Enough Data"
    )
    if avg_words > 0:
        if avg_words < 60:
            conciseness_status = "Concise"
        elif avg_words <= 220:
            conciseness_status = "Balanced"
        else:
            conciseness_status = "Verbose"

    strength_kws, growth_kws = _extract_feedback_keywords(feedback_corpus)
    communication_insights = CommunicationInsights(
        avg_word_count=avg_words,
        conciseness_status=conciseness_status,
        total_words_spoken_or_typed=total_words,
        common_strength_keywords=strength_kws,
        common_growth_keywords=growth_kws,
    )

    # Recommended Drills from Question Bank
    recommended_drills = _generate_recommended_drills(weak_spots, domains_list)

    summary = AnalyticsSummary(
        total_sessions=total_count,
        total_single_drills=len(single_scores),
        total_mock_interviews=len(mock_scores),
        average_score=avg_score,
        highest_score=highest,
        lowest_score=lowest,
        recent_average=recent_avg,
        score_trend=score_trend,
        single_average=single_avg,
        mock_average=mock_avg,
        top_strength_domain=top_strength,
        focus_domain=focus_domain,
    )

    return AnalyticsDashboardResponse(
        summary=summary,
        timeline=timeline_items,
        domains=domains_list,
        score_distribution=score_distribution,
        weak_spots=weak_spots,
        communication=communication_insights,
        recommended_drills=recommended_drills,
    )


def _generate_recommended_drills(
    weak_spots: list[WeakSpotItem],
    all_domains: list[DomainBreakdown],
) -> list[RecommendedDrill]:
    """Retrieves curated drills from the Question Bank targeted to identified gaps."""
    retriever = get_rag_retriever()
    recommendations: list[RecommendedDrill] = []
    seen_ids: set[str] = set()

    # If we have detected weak spots, target them first
    target_domains = [w.domain for w in weak_spots]
    if not target_domains and all_domains:
        # If user is high performing everywhere, pick the lowest domain or standard mix
        target_domains = [all_domains[-1].domain]

    if not target_domains:
        # Default starter domains
        target_domains = ["Software Engineering", "Behavioral & HR", "System Design"]

    for d_name in target_domains[:3]:
        results = retriever.retrieve(
            query=d_name,
            domain=d_name if d_name in ["Software Engineering", "Frontend", "Machine Learning & AI", "System Design", "DevOps & Cloud", "Data Structures & Algorithms", "Behavioral & HR"] else None,
            top_k=2,
        )
        for r in results:
            if r.id not in seen_ids:
                seen_ids.add(r.id)
                recommendations.append(
                    RecommendedDrill(
                        question_id=r.id,
                        question=r.question,
                        domain=r.domain,
                        category=r.category,
                        difficulty=r.difficulty,
                        tags=r.tags,
                        reason=f"Targets {d_name} competency enhancement",
                    )
                )

    return recommendations[:6]
