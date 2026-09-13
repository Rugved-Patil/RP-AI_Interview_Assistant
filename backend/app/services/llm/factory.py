"""
Single place that decides "which provider handles which role" - driven by
config, not hardcoded at every call site. If you ever want to swap which
provider handles which role (e.g. testing Gemini as the interviewer too),
this is the only file that needs to change.

IMPORTANT - adjust me:
The `settings.xxx` attribute names below are a guess at what you named
things in core/config.py. This assumes your Settings class has:
    groq_api_key, groq_model, gemini_api_key, gemini_model
If your actual field names differ, update the four references below to
match - everything else in this package is unaffected either way.
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache

from app.core.config import get_settings
from app.services.llm.base import LLMProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.groq_provider import GroqProvider


class LLMRole(str, Enum):
    INTERVIEWER = "interviewer"  # live Q&A / follow-up generation -> Groq
    GRADER = "grader"  # per-answer or end-of-session grading -> Gemini


@lru_cache
def get_provider(role: LLMRole) -> LLMProvider:
    """
    Returns a cached provider instance for the given role. Cached because
    there's no reason to spin up a fresh SDK client on every single call
    within one run of the app.
    """
    settings = get_settings()
    if role is LLMRole.INTERVIEWER:
        return GroqProvider(api_key=settings.groq_api_key, model=settings.groq_model)
    if role is LLMRole.GRADER:
        return GeminiProvider(api_key=settings.gemini_api_key, model=settings.gemini_model)
    raise ValueError(f"No provider configured for role: {role}")  # pragma: no cover
