"""
Request/response models for the situational practice endpoints.

Kept separate from the route files (app/api/routes/sessions.py,
grading.py) so the "shape of data crossing the API boundary" lives in one
place, independent of the route logic that produces/consumes it. FastAPI
uses these for request validation AND to generate the /docs schema
automatically - that's why response_model is worth setting on every route,
not just a nice-to-have.
"""

from pydantic import BaseModel


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