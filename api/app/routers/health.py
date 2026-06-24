"""Liveness probe — a dependency-free 200 used by ./dev.sh and uptime checks."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
