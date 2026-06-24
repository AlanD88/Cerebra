"""FastAPI application factory. Wires CORS and mounts every router under
``/api/v1``; all read routes serve projection tables, never live event scans."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import concepts, dashboard, graph, health, preferences, review, subjects


def create_app() -> FastAPI:
    """Build and configure the ASGI app (one instance is created as ``app`` below)."""
    app = FastAPI(title="Cerebra API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (health, dashboard, concepts, subjects, review, graph, preferences):
        app.include_router(module.router, prefix="/api/v1")
    return app


app = create_app()
