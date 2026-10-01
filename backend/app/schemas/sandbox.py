"""
Schemas for the Interactive Live Coding Editor and Execution Sandbox.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class SupportedLanguage(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"


class TestCase(BaseModel):
    __test__ = False
    id: int
    input_data: str
    expected_output: str
    description: str | None = None
    is_hidden: bool = False


class TestResult(BaseModel):
    __test__ = False
    test_case_id: int
    passed: bool
    input_data: str
    expected_output: str
    actual_output: str | None = None
    execution_time_ms: float = 0.0
    error: str | None = None



class RunCodeRequest(BaseModel):
    code: str
    language: SupportedLanguage = SupportedLanguage.PYTHON
    test_cases: list[TestCase] = Field(default_factory=list)
    custom_input: str | None = None
    entry_function: str | None = None


class RunCodeResponse(BaseModel):
    success: bool
    stdout: str = ""
    stderr: str = ""
    results: list[TestResult] = Field(default_factory=list)
    all_passed: bool = False
    passed_count: int = 0
    total_count: int = 0
    total_execution_time_ms: float = 0.0
    error: str | None = None


class ExampleCase(BaseModel):
    input: str
    output: str
    explanation: str | None = None


class CodingProblem(BaseModel):
    id: str
    title: str
    domain: str
    difficulty: str  # 'junior' | 'mid' | 'senior' | 'lead'
    tags: list[str] = Field(default_factory=list)
    description: str
    constraints: list[str] = Field(default_factory=list)
    examples: list[ExampleCase] = Field(default_factory=list)
    starter_code: dict[str, str] = Field(default_factory=dict)
    test_cases: list[TestCase] = Field(default_factory=list)
    entry_function: str | None = None


class CodingProblemSummary(BaseModel):
    id: str
    title: str
    domain: str
    difficulty: str
    tags: list[str] = Field(default_factory=list)
    description_snippet: str
    test_cases_count: int = 0


class GradeCodeRequest(BaseModel):
    problem_id: str | None = None
    problem_title: str
    code: str
    language: SupportedLanguage = SupportedLanguage.PYTHON
    test_results: list[TestResult] = Field(default_factory=list)
    role: str | None = None
    experience_level: str | None = None


class GradeCodeResponse(BaseModel):
    score: int  # 0 - 10
    time_complexity: str
    space_complexity: str
    correctness_assessment: str
    code_quality_feedback: str
    edge_cases_feedback: str
    recommended_improvements: list[str] = Field(default_factory=list)
    detailed_markdown: str


class SaveCodingReportRequest(BaseModel):
    problem_id: str
    problem_title: str
    domain: str
    code: str
    language: SupportedLanguage = SupportedLanguage.PYTHON
    score: int  # 0 - 10
    time_complexity: str
    space_complexity: str
    feedback_markdown: str
    role: str | None = "Software Engineer"
    company: str | None = "Coding Sandbox"

