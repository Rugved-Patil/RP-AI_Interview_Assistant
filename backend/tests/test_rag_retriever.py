"""
Unit tests for RAGRetriever service and grounding block formatting.
"""

import pytest

from app.services.rag.grounding import format_grounding_block
from app.services.rag.models import RetrievedQuestion
from app.services.rag.retriever import get_rag_retriever, get_vector_store


def test_rag_retriever_singleton():
    r1 = get_rag_retriever()
    r2 = get_rag_retriever()
    assert r1 is r2
    assert r1.vector_store is get_vector_store()


def test_rag_retriever_retrieve():
    retriever = get_rag_retriever()
    results = retriever.retrieve(
        query="Transformer self-attention mechanism",
        category="technical",
        role="Machine Learning Engineer",
        top_k=2,
    )
    assert len(results) <= 2
    assert len(results) > 0
    assert any("ml" in r.tags or "transformers" in r.tags for r in results)


def test_format_grounding_block_empty():
    assert format_grounding_block([]) == ""


def test_format_grounding_block_with_questions():
    sample = [
        RetrievedQuestion(
            id="test-1",
            question="How do you handle idempotency in APIs?",
            category="technical",
            domain="Software Engineering",
            tags=["api", "backend"],
            difficulty="mid",
            score=0.95,
            matched_tags=["api"],
            evaluation_criteria="Look for idempotency keys.",
        )
    ]
    block = format_grounding_block(sample)
    assert "Relevant exemplar interview questions" in block
    assert "How do you handle idempotency in APIs?" in block
    assert "Look for idempotency keys." in block
