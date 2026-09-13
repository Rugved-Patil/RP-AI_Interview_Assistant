"""
In-memory store for situational practice sessions.

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
class PracticeSession:
    """One situational-practice attempt: one question, one answer, one grade."""

    id: str
    question: str
    answer: str | None = None
    score: int | None = None
    feedback: str | None = None


# Process-lifetime storage. Fine for a single local user; would need to
# become a real datastore (SQLite/Redis/etc.) for multi-user or multi-process
# deployment - neither of which applies here (scope doc: local-only, $0 budget).
_sessions: dict[str, PracticeSession] = {}


def create_session(question: str) -> PracticeSession:
    session = PracticeSession(id=str(uuid.uuid4()), question=question)
    _sessions[session.id] = session
    return session


def get_session(session_id: str) -> PracticeSession | None:
    return _sessions.get(session_id)