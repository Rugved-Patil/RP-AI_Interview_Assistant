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

from app.schemas.personalization import blank_optional_becomes_none, require_role


class CreateSessionRequest(BaseModel):
    """
    Personalization context for one situational-practice question (see
    scope doc Section 3.4 - question generation personalized by
    domain/company/experience-level via prompt parameters, pulled forward
    into situational mode here rather than only Full Mock Interview).

    `role` is required - a question generated with no target role at all
    isn't meaningfully personalized. `company`/`location` are optional
    extras layered on top. In practice these three values now usually
    come from a saved InterviewPreset (schemas/preset.py) rather than
    being typed fresh each time - this schema doesn't care which, it
    just validates whatever it's handed.
    """

    role: str
    company: str | None = None
    location: str | None = None

    @field_validator("role")
    @classmethod
    def _role_not_blank(cls, value: str) -> str:
        return require_role(value)

    @field_validator("company", "location")
    @classmethod
    def _optional_blank_to_none(cls, value: str | None) -> str | None:
        return blank_optional_becomes_none(value)


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