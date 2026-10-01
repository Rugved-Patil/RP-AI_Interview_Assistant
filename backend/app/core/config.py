"""
Centralized, typed application configuration.

Why this exists instead of just calling os.getenv() everywhere:
- Every setting is declared once, with a type and a default, so a typo in an
  env var name fails loudly (a missing/misspelled key becomes a validation
  error at startup) instead of silently returning None deep in some request.
- As the LLM wrapper grows (Groq + Gemini keys, per-provider model names,
  timeouts, etc.), this is the single place new config values get added.
- get_settings() is cached (@lru_cache) so the .env file is only read once per
  process, and the same Settings instance is reused everywhere via FastAPI's
  dependency system if you want to inject it into routes later.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_CONFIG_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CONFIG_DIR.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent

_ENV_FILES = [
    ".env",
    str(_BACKEND_DIR / ".env"),
    str(_ROOT_DIR / ".env"),
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unrelated env vars instead of erroring
    )

    app_name: str = "RP-AI Interview Assistant"
    environment: str = "development"

    # --- LLM provider credentials -------------------------------------------------
    # Populated from .env or os.environ.
    groq_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GROQ_API_KEY", "groq_api_key"),
    )
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GEMINI_API_KEY", "gemini_api_key", "GOOGLE_API_KEY", "google_api_key"
        ),
    )

    # --- LLM provider models ----------------------------------------------------
    groq_model: str = "openai/gpt-oss-20b"
    gemini_model: str = "gemini-3.6-flash"

    # --- CORS -----------------------------------------------------------------
    frontend_origin: str = "http://localhost:5173"

    # --- Persistence -----------------------------------------------------------
    database_url: str = Field(
        default=f"sqlite:///{_BACKEND_DIR / 'interview_reports.db'}",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )

    # --- Local RAG Pipeline & Question Bank (Phase 3) -------------------------
    rag_enabled: bool = True
    rag_top_k: int = 3

    def model_post_init(self, __context: Any) -> None:
        if not self.gemini_api_key:
            self.gemini_api_key = (
                os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
            )
        if not self.groq_api_key:
            self.groq_api_key = os.environ.get("GROQ_API_KEY") or ""


@lru_cache
def get_settings() -> Settings:
    return Settings()

