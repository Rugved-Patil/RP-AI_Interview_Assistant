"""
RAG (Retrieval-Augmented Generation) & Question Bank package.
"""

from app.services.rag.grounding import format_grounding_block
from app.services.rag.models import (
    DifficultyLevel,
    QuestionBankStats,
    QuestionCategory,
    QuestionDoc,
    QuestionListResponse,
    RAGSearchRequest,
    RAGSearchResponse,
    RetrievedQuestion,
)
from app.services.rag.retriever import RAGRetriever, get_rag_retriever, get_vector_store
from app.services.rag.vector_store import VectorStore

__all__ = [
    "DifficultyLevel",
    "QuestionCategory",
    "QuestionDoc",
    "RetrievedQuestion",
    "RAGSearchRequest",
    "RAGSearchResponse",
    "QuestionListResponse",
    "QuestionBankStats",
    "VectorStore",
    "RAGRetriever",
    "get_rag_retriever",
    "get_vector_store",
    "format_grounding_block",
]
