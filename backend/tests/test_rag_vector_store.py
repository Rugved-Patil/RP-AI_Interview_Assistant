"""
Unit tests for the VectorStore and text tokenization algorithms in RAG pipeline.
"""

from pathlib import Path
import pytest

from app.services.rag.models import QuestionDoc
from app.services.rag.vector_store import VectorStore, _tokenize


def test_tokenize_removes_stopwords_and_creates_bigrams():
    text = "Explain the Virtual DOM in React"
    tokens = _tokenize(text)
    # Stopwords like 'the', 'in' should be filtered out
    assert "the" not in tokens
    assert "in" not in tokens
    assert "explain" in tokens
    assert "virtual" in tokens
    assert "dom" in tokens
    assert "react" in tokens
    # Bigrams should be generated
    assert "virtual_dom" in tokens or "dom_react" in tokens


def test_vector_store_initializes_and_indexes_dataset():
    store = VectorStore()
    assert len(store.documents) > 0
    assert len(store.vocabulary) > 0
    assert len(store.doc_vectors) == len(store.documents)


def test_vector_store_searches_by_keyword_and_returns_relevant_questions():
    store = VectorStore()
    results = store.search(query="Redis caching and thundering herd", top_k=3)
    assert len(results) > 0
    # Top result should be related to caching / Redis
    top_result = results[0]
    assert any(tag in ["caching", "redis", "backend"] for tag in top_result.tags)
    assert top_result.score > 0.0


def test_vector_store_category_filtering():
    store = VectorStore()
    # Search with behavioral filter
    results = store.search(query="leadership disagreement team", category="behavioral", top_k=5)
    for r in results:
        assert r.category == "behavioral"

    # Search with technical filter
    tech_results = store.search(query="Kubernetes pod deployment", category="technical", top_k=5)
    for r in tech_results:
        assert r.category == "technical"


def test_vector_store_domain_and_difficulty_filtering():
    store = VectorStore()
    results = store.search(
        query="reconciliation",
        domain="Frontend",
        top_k=3,
    )
    for r in results:
        assert r.domain == "Frontend"


def test_vector_store_get_stats():
    store = VectorStore()
    stats = store.get_stats()
    assert stats.total_questions == len(store.documents)
    assert len(stats.domains) > 0
    assert "technical" in stats.categories
    assert "behavioral" in stats.categories
    assert len(stats.tags) > 0


def test_vector_store_get_all_questions_with_filters():
    store = VectorStore()
    filtered = store.get_all_questions(category="behavioral")
    assert len(filtered) > 0
    assert all(d.category == "behavioral" for d in filtered)

    filtered_tag = store.get_all_questions(tag="redis")
    assert len(filtered_tag) > 0
    assert all("redis" in [t.lower() for t in d.tags] for d in filtered_tag)
