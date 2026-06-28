"""Runtime configuration, read once from the environment / ``.env`` at import.
Defaults let the app boot with zero external services (SQLite, no model key)."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. SQLite by default so the app runs with no external
    services; set DATABASE_URL to a PostgreSQL DSN in production."""

    database_url: str = "sqlite+pysqlite:///./cerebra.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    # AI assessment (Phase 4).
    anthropic_api_key: str | None = None
    assessment_model: str = "claude-opus-4-8"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def _normalize_postgres_driver(cls, v: str) -> str:
        """Managed Postgres providers (Neon, Vercel, Heroku) inject a bare
        ``postgres://`` / ``postgresql://`` URL, which SQLAlchemy maps to the
        psycopg2 driver. We ship psycopg (v3), so pin the driver explicitly —
        the auto-injected DATABASE_URL then works without hand-editing."""
        for prefix in ("postgresql://", "postgres://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix) :]
        return v


settings = Settings()
