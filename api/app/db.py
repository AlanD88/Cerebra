"""Database engine, session factory, and the FastAPI request-scoped session.

The engine is chosen at import time from ``settings.database_url`` — SQLite for
dev/test, PostgreSQL in production — and the ORM models are written to run on
either (see ``models.py``). Nothing else in the app constructs sessions; routes
depend on :func:`get_db` so every request gets exactly one session that is always
closed."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def engine_kwargs(url: str) -> dict:
    """Per-dialect engine options. Networked databases (PostgreSQL, Turso/libSQL)
    get liveness pre-pings; only file/in-memory SQLite needs the cross-thread
    escape hatch for FastAPI's threadpool."""
    if url.startswith("sqlite+libsql"):
        # Turso speaks libSQL over the network — treat it like any networked DB.
        # The `check_same_thread` connect arg is a file-SQLite concept the libSQL
        # driver does not accept, so it must not fall through to the branch below.
        return {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        # Allow cross-thread use (FastAPI) for the file/memory SQLite engine.
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True}


engine: Engine = create_engine(settings.database_url, future=True, **engine_kwargs(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding one session per request, closed on teardown.
    Routes commit explicitly; read-only routes never need to."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
