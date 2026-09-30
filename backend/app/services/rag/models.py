"""
Data models and schemas for the RAG Question Bank and Vector Store.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


DifficultyLevel = Literal["junior", "mid", "senior", "lead"]
QuestionCategory = Literal["technical", "behavioral"]


class QuestionDoc(BaseModel):
    """Represents a single curated question document in the question bank."""

    id: str
    question: str
    category: QuestionCategory
    domain: str
    tags: list[str] = Field(default_factory=list)
    difficulty: DifficultyLevel = "mid"
    company_archetypes: list[str] = Field(default_factory=list)
    evaluation_criteria: str | None = None


class RetrievedQuestion(BaseModel):
    """Represents a retrieved question scored by the RAG retrieval engine."""

    id: str
    question: str
    category: str
    domain: str
    tags: list[str] = Field(default_factory=list)
    difficulty: str
    score: float
    matched_tags: list[str] = Field(default_factory=list)
    evaluation_criteria: str | None = None


class RAGSearchRequest(BaseModel):
    """Request payload for testing/querying the RAG retrieval engine directly."""

    query: str = Field(..., min_length=1, max_length=500, description="Search terms or role prompt context")
    category: QuestionCategory | None = Field(None, description="Optional category filter (technical or behavioral)")
    domain: str | None = Field(None, description="Optional domain filter (e.g. Software Engineering, ML)")
    difficulty: DifficultyLevel | None = Field(None, description="Optional difficulty level filter")
    role: str | None = Field(None, description="Candidate target role for relevance boosting")
    company: str | None = Field(None, description="Target company for archetype boosting")
    top_k: int = Field(default=3, ge=1, le=20, description="Number of results to retrieve")


class RAGSearchResponse(BaseModel):
    """Response payload containing retrieved questions and retrieval metadata."""

    query: str
    total_found: int
    retrieved_questions: list[RetrievedQuestion]
    grounding_snippet: str | None = None


class QuestionListResponse(BaseModel):
    """Paginated list response for browsing question bank."""

    total: int
    items: list[QuestionDoc]


class DomainStatItem(BaseModel):
    domain: str
    count: int
    categories: list[str]


class QuestionBankStats(BaseModel):
    """Aggregated summary of the curated question bank."""

    total_questions: int
    domains: list[DomainStatItem]
    tags: list[str]
    difficulties: list[str]
    categories: list[str]
