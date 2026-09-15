"""
SQLAlchemy engine/session/Base setup for the opt-in "saved reports" store.

Deliberately separate from services/session_store.py: that file is the
in-memory, unsaved, in-progress side of a practice session (scope doc
Section 3.6). This module is the other half - the actual on-disk, explicitly
-saved side. Two separate storage mechanisms, not one "smart" store that
sometimes persists - that matches the scope doc's decision directly instead
of blurring it.

FastAPI + SQLAlchemy convention: get_db() is a generator dependency. FastAPI
calls it once per request, hands the yielded Session to the route via
Depends(get_db), and runs the code after `yield` (closing the session) once
the request finishes - success or exception. That guarantees a session is
never left open/leaked across requests, without every route remembering to
close one manually.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# check_same_thread=False is SQLite-specific: by default SQLite only allows
# the thread that created a connection to use it, but FastAPI can serve a
# request on a different thread than the one that opened the engine. Safe
# here because SessionLocal still hands each request its own Session.
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class every ORM model inherits from."""


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Creates any tables that don't exist yet.

    Deliberately not using Alembic migrations here - one table, one
    developer, a local-only $0-budget project (scope doc Section 8).
    create_all() is the right amount of tooling for that; Alembic is worth
    knowing exists for a multi-developer/production project, but adding it
    here would be solving a problem this project doesn't have.
    """
    from app.db import models  # noqa: F401  (import registers the model with Base)

    Base.metadata.create_all(bind=engine)