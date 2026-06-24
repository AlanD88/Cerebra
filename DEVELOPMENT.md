# Cerebra — Local Development

How to run, seed, and test Cerebra locally. For the product vision and the
authoritative specs, see [`README.md`](./README.md) and [`specs/`](./specs/).

## Prerequisites

- **Python ≥ 3.10** with a virtualenv at `api/.venv`
- **Node ≥ 18** (for the Vite web app)

First-time backend setup, if the venv doesn't exist yet:

```bash
cd api
python -m venv .venv
.venv/bin/pip install -e '.[dev]'     # add ',postgres' for the psycopg driver
```

## Run everything with one command

```bash
./dev.sh
```

This seeds the dev database on first run, then starts both servers and wires
them together. **Ctrl-C stops both.**

| Service | URL | Notes |
|---|---|---|
| Web | http://localhost:5173 | Vite dev server; proxies `/api` → `:8000` |
| API | http://localhost:8000 | FastAPI with auto-reload; docs at `/docs` |

No Anthropic API key is required — review scoring falls back to the `heuristic-v1`
assessor, so the full learn → review loop works offline. To use a live model,
set `ANTHROPIC_API_KEY` in `api/.env`.

## Run the pieces manually

Two terminals, if you prefer:

```bash
# terminal 1 — API
cd api
.venv/bin/python -m app.seed                        # one-time: create tables + demo data
.venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2 — web
cd web
npm install        # first run only
npm run dev
```

### Seeding

`python -m app.seed` creates the SQLite tables and loads a Linear Algebra subject
(Vectors → Matrix → Eigenvectors → SVD, with recall/problem/explanation events
already projected into metrics). It's idempotent; delete `api/cerebra.db` to start
clean. The dev DB and `.env` files are gitignored.

## Tests

```bash
# frontend (Vitest, jsdom) — no servers needed
cd web && npm test

# backend (pytest, in-memory SQLite)
cd api && .venv/bin/python -m pytest -q
```

Both suites run against a real database engine (in-memory SQLite); only the app's
own `fetch`/network boundary is stubbed. Also available in `web/`: `npm run
typecheck`, `npm run lint`, `npm run build`.

## Things worth seeing locally

- **Optional modes** — the toggle switch in each surface header: *Focus* (Concept
  page), *Immersive* (`/graph`), *Tutor* (during a review). Flip one and reload —
  it persists via `localStorage` + the `/preferences` row.
- **Code-splitting** — open DevTools → Network on `/`; the `GraphPage` (React Flow)
  and `Tex` (KaTeX) chunks load only when you navigate to `/graph` or a concept.
- **Keyboard / a11y** — Tab to a graph node → Enter opens the inspector → Esc closes
  and returns focus to the node. Enable OS "reduce motion" and the graph settles
  instantly.

## Deliberate deviations from the spec

These are intentional choices for a local, single-developer build — each is a
swap-in point, not a weakened invariant:

- **SQLite for dev/test, PostgreSQL for prod.** Models are dialect-agnostic
  (Python-generated UUIDs, tz-aware timestamps, portable enums). Set `DATABASE_URL`
  to a Postgres DSN for production; nothing else changes.
- **Heuristic review scoring** (`scoring.py`, `assessed_by="heuristic-v1"`) when no
  `ANTHROPIC_API_KEY` is set, so the app runs with no external services. The score
  is still AI-assigned and read-only — the no-self-grading invariant holds either way.
- **List virtualization is deferred.** `specs/polish-frontend.md` §4 gates it at
  ~50 rows; the seed has 4 concepts, so adding `react-window` now would be dead
  weight. It's the natural first follow-up when real datasets grow (weak-concepts,
  recall queue, dependency lists).

## Backlog / follow-ups

Tracked here so we can come back to them:

- **Flesh out the Subjects and Settings pages.** Both resolve today
  (`web/src/features/subjects/`, `web/src/features/settings/`) but are intentionally
  minimal — they weren't part of the original four-surface spec, and were added to
  fix dead sidebar links. Candidate work: Subjects could gain per-concept
  drill-down and a "start review for this subject" action; Settings could grow
  account/data controls beyond the display-mode toggles.
- **List virtualization** — see *Deliberate deviations* above; wire up
  `react-window` for the weak-concepts, recall-queue and dependency lists once any
  realistically exceeds ~50 rows.
