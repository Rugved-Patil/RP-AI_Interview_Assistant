"""
Prompt Grounding utilities for injecting RAG exemplar questions into LLM prompts.
"""

from __future__ import annotations

from typing import Sequence

from app.services.rag.models import RetrievedQuestion


def format_grounding_block(retrieved_questions: Sequence[RetrievedQuestion]) -> str:
    """
    Formats retrieved exemplar questions into a concise, high-signal grounding block
    to be appended to the LLM system prompt.
    """
    if not retrieved_questions:
        return ""

    lines = [
        "Relevant exemplar interview questions from the verified question bank for inspiration and grounding:"
    ]
    for idx, q in enumerate(retrieved_questions, 1):
        line = f'{idx}. [{q.domain} | {q.difficulty.upper()}] "{q.question}"'
        if q.evaluation_criteria:
            line += f" (Core focus: {q.evaluation_criteria})"
        lines.append(line)

    lines.append(
        "Use the depth, technical nuance, and realistic framing of these exemplars as grounding inspiration. "
        "Formulate a fresh, high-quality, and role-appropriate question tailored to the candidate's target background."
    )

    return "\n\n" + "\n".join(lines)
