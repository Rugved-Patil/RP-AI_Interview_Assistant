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

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unrelated env vars instead of erroring
    )

    app_name: str = "RP-AI Interview Assistant"
    environment: str = "development"

    # --- LLM provider credentials -------------------------------------------------
    # Populated from .env (see .env.example). Never hardcode real keys here,
    # and .env itself must stay out of git (already covered by your .gitignore).
    groq_api_key: str = ""
    gemini_api_key: str = ""

    # --- CORS -----------------------------------------------------------------
    # The Vite dev server's default origin, so the React frontend (Phase 1
    # onward) is allowed to call this API from the browser during local dev.
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
