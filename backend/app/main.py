"""
FastAPI application entry point.

Run from inside backend/, with the venv active:
    uvicorn app.main:app --reload --port 8000

Then check:
    http://localhost:8000/           -> {"message": "..."}
    http://localhost:8000/health     -> {"status": "ok", ...}
    http://localhost:8000/docs       -> interactive Swagger UI (free from FastAPI)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import grading, health, presets, reports, sessions
from app.core.config import get_settings
from app.db.base import init_db

settings = get_settings()
init_db()

app = FastAPI(
    title=settings.app_name,
    description="Backend for the RP-AI mock interview practice app.",
    version="1.0.0",
)

# Allows the React (Vite) dev server to call this API from the browser.
# Without this, the browser's CORS policy blocks the frontend's requests
# even though curl/Postman would work fine — a classic first-week FastAPI+React gotcha.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sessions.router)
app.include_router(grading.router)
app.include_router(reports.router)
app.include_router(presets.router)


@app.get("/")
def root():
    return {"message": f"{settings.app_name} API is running."}