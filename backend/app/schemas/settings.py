"""
Pydantic schemas for application settings, engine diagnostics, and data export/import.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class SettingsConfigResponse(BaseModel):
    app_name: str
    evaluator_configured: bool
    evaluator_key_preview: str | None = None
    interviewer_configured: bool
    interviewer_key_preview: str | None = None
    rag_enabled: bool
    rag_questions_count: int
    total_single_reports: int
    total_mock_reports: int
    total_presets: int


class ProviderVerificationResult(BaseModel):
    ok: bool
    message: str
    provider: str
    latency_ms: float | None = None


class VerifyConnectionsResponse(BaseModel):
    evaluator: ProviderVerificationResult
    interviewer: ProviderVerificationResult
    all_ok: bool


class ExportDataResponse(BaseModel):
    version: str = "1.0"
    exported_at: str
    saved_reports: list[dict[str, Any]] = Field(default_factory=list)
    saved_interview_reports: list[dict[str, Any]] = Field(default_factory=list)
    presets: list[dict[str, Any]] = Field(default_factory=list)


class ImportDataRequest(BaseModel):
    saved_reports: list[dict[str, Any]] | None = None
    saved_interview_reports: list[dict[str, Any]] | None = None
    presets: list[dict[str, Any]] | None = None


class ImportDataResponse(BaseModel):
    imported_single_reports: int
    imported_mock_reports: int
    imported_presets: int
    total_imported: int
    message: str


class ClearDataRequest(BaseModel):
    clear_single_reports: bool = False
    clear_mock_reports: bool = False
    clear_presets: bool = False
    clear_all: bool = False


class ClearDataResponse(BaseModel):
    cleared_single_reports: int
    cleared_mock_reports: int
    cleared_presets: int
    message: str
