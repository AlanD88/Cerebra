"""Vercel serverless entry point.

Vercel's Python runtime treats files under the repo-root ``api/`` directory as
serverless functions and serves the ASGI ``app`` exported here — the very same
FastAPI app used locally (`uvicorn app.main:app`). Routing is handled by
``vercel.json``: ``/api/(.*)`` is rewritten to this function, which then matches
the request against the app's own ``/api/v1`` routes.

The ``sys.path`` insert makes the sibling ``app`` package importable no matter
what working directory Vercel invokes the function from.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.main import app  # noqa: E402  (path shim must run first)

__all__ = ["app"]
