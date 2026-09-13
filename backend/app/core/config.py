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

    # --- LLM provider models ----------------------------------------------------
    # llama-3.3-70b-versatile moved to Groq's Enterprise-only tier - the free/
    # developer tier's current recommended replacements are the openai/gpt-oss
    # models. gpt-oss-20b is used here since it's the faster of the two
    # (~1000 tok/sec vs ~500), which matters for the low-latency interviewer
    # role; swap to openai/gpt-oss-120b if you want more capability over speed.
    groq_model: str = "openai/gpt-oss-20b"
    # gemini-1.5-flash has likewise been superseded. Groq and Google both
    # deprecate/rename models fairly often on the free tier - if you hit a
    # 404 "model not found" again, check https://console.groq.com/docs/models
    # or https://ai.google.dev/gemini-api/docs/models for the current list
    # and update these two defaults (or override via .env instead of editing
    # code, using GROQ_MODEL= / GEMINI_MODEL=).
    gemini_model: str = "gemini-2.5-flash"

    # --- CORS -----------------------------------------------------------------
    # The Vite dev server's default origin, so the React frontend (Phase 1
    # onward) is allowed to call this API from the browser during local dev.
    frontend_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
