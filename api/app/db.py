from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def engine_kwargs(url: str) -> dict:
    if url.startswith("sqlite"):
        # Allow cross-thread use (FastAPI) for the file/memory SQLite engine.
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True}


engine: Engine = create_engine(settings.database_url, future=True, **engine_kwargs(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
