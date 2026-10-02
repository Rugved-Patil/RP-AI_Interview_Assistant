"""
Question Bank and Local RAG exploration endpoints (Phase 3).

Endpoints:
    GET  /questions           -> list/filter question bank documents
    GET  /questions/domains   -> get domain/tag/difficulty summary stats
    GET  /questions/{id}      -> retrieve a single question by ID
    POST /questions/search    -> run RAG vector retrieval directly with match scoring
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.rag import (
    DifficultyLevel,
    QuestionBankStats,
    QuestionCategory,
    QuestionDoc,
    QuestionListResponse,
    RAGSearchRequest,
    RAGSearchResponse,
    format_grounding_block,
    get_rag_retriever,
)

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=QuestionListResponse)
def list_questions(
    category: QuestionCategory | None = Query(None, description="Filter by category (technical or behavioral)"),
    domain: str | None = Query(None, description="Filter by domain"),
    difficulty: DifficultyLevel | None = Query(None, description="Filter by difficulty"),
    tag: str | None = Query(None, description="Filter by tag keyword"),
    search: str | None = Query(None, description="Optional text search query"),
    limit: int = Query(100, ge=1, le=1000, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> QuestionListResponse:
    """Lists questions in the curated question bank with optional filtering and pagination."""
    retriever = get_rag_retriever()

    if search:
        # Use RAG vector search if a query search term is provided
        retrieved = retriever.retrieve(
            query=search,
            category=category,
            domain=domain,
            difficulty=difficulty,
            top_k=min(limit + offset, 100),
        )
        matched_docs = [
            QuestionDoc(
                id=r.id,
                question=r.question,
                category=r.category,  # type: ignore[arg-type]
                domain=r.domain,
                tags=r.tags,
                difficulty=r.difficulty,  # type: ignore[arg-type]
                evaluation_criteria=r.evaluation_criteria,
            )
            for r in retrieved
        ]
        if tag:
            matched_docs = [d for d in matched_docs if tag.lower() in [t.lower() for t in d.tags]]
        total = len(matched_docs)
        items = matched_docs[offset : offset + limit]
        return QuestionListResponse(total=total, items=items)

    all_docs = retriever.list_questions(
        category=category,
        domain=domain,
        difficulty=difficulty,
        tag=tag,
    )
    total = len(all_docs)
    items = all_docs[offset : offset + limit]
    return QuestionListResponse(total=total, items=items)


@router.get("/domains", response_model=QuestionBankStats)
def get_question_bank_stats() -> QuestionBankStats:
    """Returns aggregated summary metrics, available domains, tags, and categories."""
    retriever = get_rag_retriever()
    return retriever.vector_store.get_stats()


@router.get("/{question_id}", response_model=QuestionDoc)
def get_question_by_id(question_id: str) -> QuestionDoc:
    """Retrieves a single question document by unique ID."""
    retriever = get_rag_retriever()
    doc = retriever.get_question(question_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=f"Question '{question_id}' not found")
    return doc


@router.post("/search", response_model=RAGSearchResponse)
def search_rag(body: RAGSearchRequest) -> RAGSearchResponse:
    """
    Executes the local RAG retrieval engine with hybrid scoring.
    Returns matching exemplar questions, similarity scores, matched tags, and grounding snippet.
    """
    retriever = get_rag_retriever()
    results = retriever.retrieve(
        query=body.query,
        category=body.category,
        domain=body.domain,
        difficulty=body.difficulty,
        role=body.role,
        company=body.company,
        top_k=body.top_k,
    )

    grounding_snippet = format_grounding_block(results) if results else None

    return RAGSearchResponse(
        query=body.query,
        total_found=len(results),
        retrieved_questions=results,
        grounding_snippet=grounding_snippet,
    )
