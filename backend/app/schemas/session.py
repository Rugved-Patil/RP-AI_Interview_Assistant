"""
Request/response models for the situational practice endpoints.

Kept separate from the route files (app/api/routes/sessions.py,
grading.py) so the "shape of data crossing the API boundary" lives in one
place, independent of the route logic that produces/consumes it. FastAPI
uses these for request validation AND to generate the /docs schema
automatically - that's why response_model is worth setting on every route,
not just a nice-to-have.
"""

from pydantic import BaseModel, field_validator


class CreateSessionRequest(BaseModel):
    """
    Personalization context for one situational-practice question (see
    scope doc Section 3.4 - question generation personalized by
    domain/company/experience-level via prompt parameters, pulled forward
    into situational mode here rather than only Full Mock Interview).

    `role` is required - a question generated with no target role at all
    isn't meaningfully personalized. `company`/`location` are optional
    extras layered on top.
    """

    role: str
    company: str | None = None
    location: str | None = None

    @field_validator("role")
    @classmethod
    def role_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("role is required")
        return stripped

    @field_validator("company", "location")
    @classmethod
    def blank_optional_becomes_none(cls, value: str | None) -> str | None:
        # An empty string from an untouched optional frontend field should
        # behave the same as never sending the field at all - otherwise the
        # prompt builder would have to treat "" and None as two different
        # "not provided" cases.
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class CreateSessionResponse(BaseModel):
    session_id: str
    question: str


class SubmitAnswerRequest(BaseModel):
    answer: str


class SubmitAnswerResponse(BaseModel):
    session_id: str
    status: str = "answer_recorded"


class GradeResponse(BaseModel):
    session_id: str
    score: int
    feedback: str