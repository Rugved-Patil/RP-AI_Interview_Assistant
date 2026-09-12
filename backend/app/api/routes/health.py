"""
Liveness/readiness check.

Kept in its own module (rather than inline in main.py) to establish the
pattern you'll repeat for every future feature: one router per concern
(health, sessions, grading, ...), each included into the app in main.py.
This keeps main.py as a thin composition point instead of a growing pile
of route handlers.
"""

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check():
    """
    Confirms the process is up and config loaded successfully.

    Note: this deliberately does NOT validate that GROQ_API_KEY/GEMINI_API_KEY
    are *correct* (that would mean making a live API call on every health
    check). It only reflects that config loaded. A "does this key actually
    work" check belongs in the LLM wrapper itself, once that exists.
    """
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
    }
