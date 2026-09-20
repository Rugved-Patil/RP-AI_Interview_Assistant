"""
In-memory store for Technical questions sessions.

Why in-memory and not SQLite:
Per the scope doc (Section 3.6, "Resolved"): a report is NOT saved
automatically - the user has to explicitly opt in (a future "Save this
report" action) before anything touches disk. Until that happens, a
session only needs to survive for the lifetime of one practice attempt,
in this one running server process. A plain dict is the simplest thing
that satisfies that - SQLite only enters the picture later, when we build
the opt-in save endpoint on top of this.

Trade-off, accepted deliberately: restarting the backend wipes every
in-progress (unsaved) session. That's fine for a single local user
practicing interactively - it's the same lifetime as, say, an unsaved
browser tab.

This is intentionally the ONLY place that touches the sessions dict.
Routes call these functions; they never poke at a module-level dict
directly. That means if this later becomes a database table instead of
a dict, only this one file changes.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class TechnicalSession:
    """
    One Technical questions attempt: one question, one answer, one grade.

    role/company/location are the personalization context the question was
    generated for (scope doc Section 3.4). They're captured on the session
    - not just used transiently in the prompt at creation time - because
    grading later needs the same context to judge the answer against the
    right bar (see grading.py's _build_grader_prompt).
    """

    id: str
    question: str
    role: str
    company: str | None = None
    location: str | None = None
    answer: str | None = None
    score: int | None = None
    feedback: str | None = None


# Process-lifetime storage. Fine for a single local user; would need to
# become a real datastore (SQLite/Redis/etc.) for multi-user or multi-process
# deployment - neither of which applies here (scope doc: local-only, $0 budget).
_sessions: dict[str, TechnicalSession] = {}


def create_session(
    question: str,
    role: str,
    company: str | None = None,
    location: str | None = None,
) -> TechnicalSession:
    session = TechnicalSession(
        id=str(uuid.uuid4()),
        question=question,
        role=role,
        company=company,
        location=location,
    )
    _sessions[session.id] = session
    return session


def get_session(session_id: str) -> TechnicalSession | None:
    return _sessions.get(session_id)