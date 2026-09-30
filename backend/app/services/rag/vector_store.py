"""
Local Vector Store & Hybrid Search Engine for the Question Bank.

Features:
- Pure Python, zero-dependency, $0 budget, completely offline execution.
- Computes sublinear TF-IDF + BM25-weighted n-gram term vectors over questions, tags, domains, and criteria.
- L2-normalized sparse-dense vector representation with exact Cosine Similarity.
- Hybrid ranking scoring function:
    final_score = (
        0.50 * vector_cosine_similarity +
        0.25 * tag_overlap_score +
        0.15 * domain_category_match +
        0.10 * difficulty_match
    )
- Fast in-memory indexing loaded on demand or at startup.
"""

from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from pathlib import Path

from app.services.rag.models import (
    DifficultyLevel,
    DomainStatItem,
    QuestionBankStats,
    QuestionCategory,
    QuestionDoc,
    RetrievedQuestion,
)


def _tokenize(text: str) -> list[str]:
    """
    Extracts normalized alphanumeric tokens (lowercase words and 2-grams)
    while removing standard English stopwords.
    """
    text = text.lower()
    # Normalize punctuation and delimiters
    words = re.findall(r"\b[a-z0-9_\-+#]{2,}\b", text)
    stopwords = {
        "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
        "about", "against", "between", "into", "through", "during", "before",
        "after", "above", "below", "from", "up", "down", "of", "off", "over",
        "under", "again", "further", "then", "once", "here", "there", "when",
        "where", "why", "how", "all", "any", "both", "each", "few", "more",
        "most", "other", "some", "such", "no", "nor", "not", "only", "own",
        "same", "so", "than", "too", "very", "can", "will", "just", "should",
        "now", "is", "are", "was", "were", "be", "been", "being", "have",
        "has", "had", "do", "does", "did", "you", "your", "they", "their",
        "this", "that", "these", "those", "what", "which", "who", "whom",
    }
    filtered = [w for w in words if w not in stopwords and len(w) > 1]
    
    # Generate bigrams for multi-word technical concepts (e.g., "system design", "virtual dom", "rate limiting")
    bigrams = [f"{filtered[i]}_{filtered[i+1]}" for i in range(len(filtered) - 1)]
    return filtered + bigrams


class VectorStore:
    """In-memory Vector Store and Hybrid Index for the Question Bank."""

    def __init__(self, dataset_path: str | Path | None = None) -> None:
        self.documents: list[QuestionDoc] = []
        self.doc_map: dict[str, QuestionDoc] = {}
        
        # Vocabulary and Term Weighting
        self.vocabulary: dict[str, int] = {}
        self.idf: dict[str, float] = {}
        self.doc_vectors: list[dict[int, float]] = []  # term_idx -> normalized_weight
        self.doc_lengths: list[float] = []
        self.avg_doc_length: float = 0.0
        
        # Default data path
        if dataset_path is None:
            dataset_path = Path(__file__).parent / "data" / "question_bank.json"
        self.dataset_path = Path(dataset_path)
        self.load_dataset(self.dataset_path)

    def load_dataset(self, path: Path) -> None:
        """Loads question documents from JSON file and builds the vector index."""
        if not path.exists():
            raise FileNotFoundError(f"Question bank dataset not found at {path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.documents = [QuestionDoc(**item) for item in data]
        self.doc_map = {doc.id: doc for doc in self.documents}
        self._build_index()

    def _build_index(self) -> None:
        """Constructs the vocabulary, IDF weights, and normalized document term vectors."""
        num_docs = len(self.documents)
        if num_docs == 0:
            return

        doc_tokens_list: list[list[str]] = []
        df_counts: Counter[str] = Counter()

        for doc in self.documents:
            # Aggregate textual content with domain and tag boosts
            content_parts = [
                doc.question,
                f"{doc.domain} {doc.domain}",  # double weight
                " ".join(doc.tags * 3),        # triple weight for tags
                f"{doc.category} {doc.category}",
                " ".join(doc.company_archetypes * 2),
                doc.evaluation_criteria or "",
            ]
            full_text = " ".join(content_parts)
            tokens = _tokenize(full_text)
            doc_tokens_list.append(tokens)
            
            # Count document frequencies (unique terms per doc)
            unique_terms = set(tokens)
            for term in unique_terms:
                df_counts[term] += 1

        # Build vocabulary mapping: term -> term_index
        self.vocabulary = {term: idx for idx, term in enumerate(df_counts.keys())}
        
        # Compute smooth BM25-style IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
        self.idf = {
            term: math.log(1.0 + (num_docs - df + 0.5) / (df + 0.5))
            for term, df in df_counts.items()
        }

        # Compute document lengths for BM25 normalization
        lengths = [len(tokens) for tokens in doc_tokens_list]
        self.avg_doc_length = sum(lengths) / num_docs if num_docs > 0 else 1.0

        # Build sparse term vectors with sublinear TF scaling
        self.doc_vectors = []
        k1 = 1.2
        b = 0.75

        for tokens, doc_len in zip(doc_tokens_list, lengths):
            tf_counts = Counter(tokens)
            vec: dict[int, float] = {}
            squared_sum = 0.0

            for term, tf in tf_counts.items():
                if term in self.vocabulary:
                    term_idx = self.vocabulary[term]
                    idf_val = self.idf[term]
                    # BM25-scaled Term Frequency
                    denom = tf + k1 * (1.0 - b + b * (doc_len / self.avg_doc_length))
                    tf_scaled = (tf * (k1 + 1.0)) / denom if denom > 0 else 0.0
                    weight = tf_scaled * idf_val
                    vec[term_idx] = weight
                    squared_sum += weight * weight

            # Normalize to unit length for fast cosine similarity via dot product
            norm = math.sqrt(squared_sum)
            if norm > 0:
                normalized_vec = {idx: w / norm for idx, w in vec.items()}
            else:
                normalized_vec = vec

            self.doc_vectors.append(normalized_vec)

    def _vectorize_query(self, query: str) -> dict[int, float]:
        """Converts a search query into an L2-normalized term vector."""
        tokens = _tokenize(query)
        tf_counts = Counter(tokens)
        vec: dict[int, float] = {}
        squared_sum = 0.0

        for term, tf in tf_counts.items():
            if term in self.vocabulary:
                term_idx = self.vocabulary[term]
                # Sublinear TF scaling for query
                tf_scaled = 1.0 + math.log(tf)
                weight = tf_scaled * self.idf[term]
                vec[term_idx] = weight
                squared_sum += weight * weight

        norm = math.sqrt(squared_sum)
        if norm > 0:
            return {idx: w / norm for idx, w in vec.items()}
        return vec

    def search(
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
        Executes hybrid multi-signal retrieval:
        1. Sparse Vector Cosine Similarity (TF-IDF / BM25 term vectors)
        2. Tag & Keyword Overlap
        3. Domain & Category Match
        4. Target Difficulty & Company Archetype Alignment
        """
        if not self.documents:
            return []

        # Enhance query with role and company context if supplied
        full_query = query
        if role:
            full_query = f"{role} {full_query}"
        if company:
            full_query = f"{company} {full_query}"

        query_vec = self._vectorize_query(full_query)
        query_tokens = set(_tokenize(full_query))

        candidates: list[tuple[float, QuestionDoc, list[str]]] = []

        for idx, doc in enumerate(self.documents):
            # Hard filter on category if strictly specified
            if category and doc.category != category:
                continue

            # Hard filter on domain if strictly specified
            if domain and doc.domain.lower() != domain.lower():
                continue

            # 1. Cosine similarity
            doc_vec = self.doc_vectors[idx]
            cosine_sim = sum(
                query_vec[t_idx] * doc_vec[t_idx]
                for t_idx in query_vec
                if t_idx in doc_vec
            )
            # Clip between 0.0 and 1.0
            cosine_sim = max(0.0, min(1.0, cosine_sim))

            # 2. Tag overlap score & matched tags
            matched_tags: list[str] = []
            for tag in doc.tags:
                tag_tokens = set(_tokenize(tag))
                if tag_tokens and tag_tokens.issubset(query_tokens):
                    matched_tags.append(tag)
                elif any(t in query_tokens for t in tag_tokens):
                    matched_tags.append(tag)

            tag_score = len(matched_tags) / max(1, len(doc.tags))
            tag_score = min(1.0, tag_score)

            # 3. Domain match boost
            domain_tokens = set(_tokenize(doc.domain))
            domain_match = 1.0 if domain_tokens.intersection(query_tokens) else 0.0

            # 4. Difficulty alignment boost
            difficulty_boost = 0.0
            if difficulty:
                if doc.difficulty == difficulty:
                    difficulty_boost = 1.0
                elif (
                    (difficulty == "junior" and doc.difficulty == "mid")
                    or (difficulty == "senior" and doc.difficulty in ("mid", "lead"))
                ):
                    difficulty_boost = 0.5

            # 5. Company Archetype Boost
            company_boost = 0.0
            if company:
                company_lower = company.lower()
                for archetype in doc.company_archetypes:
                    if archetype in company_lower or (
                        archetype == "faang" and any(f in company_lower for f in ["google", "meta", "apple", "amazon", "netflix", "microsoft"])
                    ):
                        company_boost = 1.0
                        break

            # Composite Hybrid Score
            composite_score = (
                0.45 * cosine_sim +
                0.25 * tag_score +
                0.15 * domain_match +
                0.10 * difficulty_boost +
                0.05 * company_boost
            )

            candidates.append((composite_score, doc, matched_tags))

        # Sort candidates descending by score
        candidates.sort(key=lambda x: x[0], reverse=True)
        top_candidates = candidates[:top_k]

        results: list[RetrievedQuestion] = []
        for score, doc, matched_tags in top_candidates:
            results.append(
                RetrievedQuestion(
                    id=doc.id,
                    question=doc.question,
                    category=doc.category,
                    domain=doc.domain,
                    tags=doc.tags,
                    difficulty=doc.difficulty,
                    score=round(score, 4),
                    matched_tags=matched_tags,
                    evaluation_criteria=doc.evaluation_criteria,
                )
            )

        return results

    def get_all_questions(
        self,
        category: QuestionCategory | None = None,
        domain: str | None = None,
        difficulty: DifficultyLevel | None = None,
        tag: str | None = None,
    ) -> list[QuestionDoc]:
        """Returns filtered list of question documents."""
        results: list[QuestionDoc] = []
        for doc in self.documents:
            if category and doc.category != category:
                continue
            if domain and doc.domain.lower() != domain.lower():
                continue
            if difficulty and doc.difficulty != difficulty:
                continue
            if tag and tag.lower() not in [t.lower() for t in doc.tags]:
                continue
            results.append(doc)
        return results

    def get_stats(self) -> QuestionBankStats:
        """Returns aggregated summary stats of the question bank."""
        domain_counts: dict[str, set[str]] = {}
        tags_set: set[str] = set()
        diff_set: set[str] = set()
        cat_set: set[str] = set()

        for doc in self.documents:
            if doc.domain not in domain_counts:
                domain_counts[doc.domain] = set()
            domain_counts[doc.domain].add(doc.category)
            tags_set.update(doc.tags)
            diff_set.add(doc.difficulty)
            cat_set.add(doc.category)

        domains = [
            DomainStatItem(
                domain=domain,
                count=sum(1 for d in self.documents if d.domain == domain),
                categories=sorted(list(cats)),
            )
            for domain, cats in sorted(domain_counts.items())
        ]

        return QuestionBankStats(
            total_questions=len(self.documents),
            domains=domains,
            tags=sorted(list(tags_set)),
            difficulties=sorted(list(diff_set)),
            categories=sorted(list(cat_set)),
        )
