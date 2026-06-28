"""Create the schema against the configured database, with no seed data.

Operational entrypoint for provisioning a fresh production DB (e.g. Turso):

    DATABASE_URL='sqlite+libsql://<db>.turso.io/?authToken=<token>&secure=true' \
        python -m app.initdb

Reads ``DATABASE_URL`` from the environment (see ``config.py``) and runs
``Base.metadata.create_all`` once. Idempotent — existing tables are left intact.
For an empty schema use this; to also load the demo subject use ``app.seed``,
which creates the schema and then seeds.
"""

from __future__ import annotations


def main() -> None:  # pragma: no cover - operational entrypoint
    import app.models  # noqa: F401 — register every model on Base.metadata

    from .db import Base, engine

    Base.metadata.create_all(engine)
    print(f"Schema created on {engine.url.render_as_string(hide_password=True)}")


if __name__ == "__main__":  # pragma: no cover
    main()
