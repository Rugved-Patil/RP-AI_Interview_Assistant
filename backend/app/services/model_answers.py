"""
Service for generating and formatting realistic 8/10 benchmark exemplar model answers
and actionable test track directives for recommended practice questions.
"""

from __future__ import annotations


def get_recommended_test_directive(category: str, domain: str, difficulty: str) -> tuple[str, str]:
    """
    Returns (recommended_test_type, recommended_test_label) for the given question parameters.
    """
    cat_lower = category.lower()
    diff_title = difficulty.capitalize()

    if cat_lower == "behavioral":
        return "behavioral_drill", f"Behavioral STAR Drill ({diff_title})"
    
    # If senior/lead system design or architecture, recommend full mock or single technical drill
    if domain.lower() in ("system design", "leadership", "executive leadership") or difficulty.lower() in ("senior", "lead"):
        return "mock_interview", f"Technical Mock Interview ({domain} · {diff_title})"
    
    return "single_drill", f"Technical Practice Drill ({domain} · {diff_title})"


def generate_8_out_of_10_model_answer(
    question: str,
    category: str,
    domain: str,
    difficulty: str,
    evaluation_criteria: str | None = None,
    tags: list[str] | None = None,
) -> tuple[str, str]:
    """
    Constructs an authentic, calibrated 8/10 benchmark model answer along with
    a transparent scoring breakdown explaining why the answer qualifies as solid proficiency (8/10).

    Returns:
        (model_answer_markdown, scoring_breakdown_markdown)
    """
    is_behavioral = category.lower() == "behavioral"
    tag_list = tags or []
    tag_str = ", ".join(tag_list[:3]) if tag_list else domain

    if is_behavioral:
        model_answer = (
            f"**Situation:** In my previous role, our team faced an urgent challenge where {question.rstrip('?').lower()}. "
            f"Cross-functional alignment was strained, and delivery deadlines were at risk.\n\n"
            f"**Task:** As the responsible lead, my objective was to establish clarity, align key stakeholders on a unified plan, "
            f"and unblock the execution path without compromising quality or team morale.\n\n"
            f"**Action:**\n"
            f"- **Transparent Communication:** Scheduled a 30-minute sync with all core stakeholders to map out root causes and distinct requirements.\n"
            f"- **Prioritization & Trade-offs:** Deconstructed the problem into immediate must-haves versus post-launch enhancements, agreeing on clear acceptance criteria.\n"
            f"- **Collaborative Execution:** Established daily asynchronous checkpoints and created a single source of truth document to eliminate misunderstandings.\n\n"
            f"**Result:** We delivered the core deliverables 3 days ahead of the adjusted schedule with zero critical post-release regressions. "
            f"In the post-mortem retrospective, we codified this communication protocol into our team handbook, reducing recurring bottlenecks by over 40%."
        )
        scoring_breakdown = (
            "- **Structure (8/10):** Strictly adheres to the STAR framework with clear delineation between Situation, Task, Action, and Result.\n"
            "- **Action Specificity:** Describes proactive stakeholder management, collaborative prioritization, and measurable process improvements.\n"
            "- **Measurable Outcome:** Cites concrete delivery metrics and retrospective learnings.\n"
            "- **Path to 10/10:** Could provide deeper quantifiable business metrics (e.g. revenue impact) and discuss long-term cultural shifts."
        )
    else:
        criteria_snippet = (
            evaluation_criteria
            if evaluation_criteria
            else f"Core architectural concepts, trade-off comparisons, and production operational considerations for {domain}."
        )

        model_answer = (
            f"**1. Core Concept & Architectural Mechanism:**\n"
            f"At a foundational level, addressing this involves understanding the interaction between components: {criteria_snippet.rstrip('.')}. "
            f"When implementing this in a production environment, we ensure high cohesion and clear operational boundaries across the lifecycle.\n\n"
            f"**2. Practical Trade-offs & Design Choices:**\n"
            f"- **Primary Approach:** Prioritizes reliability, clean abstractions, and predictable failure modes over premature optimizations.\n"
            f"- **Alternative Considered:** While more lightweight in the short term, naive implementations introduce hidden latency spikes and maintenance overhead under high load.\n\n"
            f"**3. Production Edge Cases & Failure Handling:**\n"
            f"- **Resilience & Degraded Modes:** Implement defensive safeguards (e.g. timeouts, rate throttling, circuit breaking, idempotent retries).\n"
            f"- **Observability:** Emit structured metrics, telemetry traces, and proactive alerts to monitor anomalies before they impact end users."
        )
        scoring_breakdown = (
            f"- **Technical Correctness (8/10):** Directly addresses core mechanisms ({tag_str}) with accurate terminology and clear component boundaries.\n"
            f"- **Trade-off Analysis:** Explicitly contrasts the primary approach with trade-offs regarding maintainability, latency, and throughput.\n"
            f"- **Production Mindset:** Covers real-world edge cases including circuit breakers, graceful degradation, and observability.\n"
            f"- **Path to 10/10:** Could write exact code snippets or mathematical bounds (O(N) analysis) for complex edge-case throughput."
        )

    return model_answer, scoring_breakdown
