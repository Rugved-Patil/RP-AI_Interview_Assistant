"""
High-level RAG Retriever service for RP-AI Interview Assistant.
Provides a singleton interface to the underlying VectorStore.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Sequence

from app.services.rag.models import (
    DifficultyLevel,
    QuestionCategory,
    QuestionDoc,
    RetrievedQuestion,
)
from app.services.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGRetriever:
    """Coordinates search and retrieval from the Question Bank Vector Store."""

    def __init__(self, vector_store: VectorStore | None = None) -> None:
        self.vector_store = vector_store or VectorStore()

    def retrieve(
        self,
        query: str,
        category: QuestionCategory | None = None,
        domain: str | None = None,
        difficulty: DifficultyLevel | None = None,
        role: str | None = None,
        company: str | None = None,
        top_k: int = 3,
    ) -> list[RetrievedQuestion]:
        """
        Retrieves top-k most relevant exemplar questions for a given prompt context.
        """
        try:
            return self.vector_store.search(
                query=query,
                category=category,
                domain=domain,
                difficulty=difficulty,
                role=role,
                company=company,
                top_k=top_k,
            )
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s. Falling back to empty results.", exc)
            return []

    def get_question(self, question_id: str) -> QuestionDoc | None:
        """Looks up a single question doc by ID."""
        return self.vector_store.doc_map.get(question_id)

    def list_questions(
        self,
        category: QuestionCategory | None = None,
        domain: str | None = None,
        difficulty: DifficultyLevel | None = None,
        tag: str | None = None,
    ) -> list[QuestionDoc]:
        """Lists questions matching filter criteria."""
        return self.vector_store.get_all_questions(
            category=category,
            domain=domain,
            difficulty=difficulty,
            tag=tag,
        )


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    """Returns the cached global VectorStore instance."""
    return VectorStore()


@lru_cache(maxsize=1)
def get_rag_retriever() -> RAGRetriever:
    """Returns the cached global RAGRetriever service instance."""
    return RAGRetriever(get_vector_store())
