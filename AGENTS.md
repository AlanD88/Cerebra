# AGENTS.md — orientation for AI agents & contributors

This file is the **map**. It tells any agent where to look, what must stay true,
and how to run the project. It does not repeat the detail those documents already
hold — follow the links.

Cerebra is a personal learning operating system built on one idea: **mastery is
not stored, it is derived.** The learner produces *events* (recalls, problem
attempts, explanations); a deterministic, replayable projection folds those into
the metrics and schedules the UI reads. Every surface is a view over projection
tables — never a live scan of raw events.

---

## Read these first (in this order)

| Document | What it gives you |
|---|---|
| [`README.md`](./README.md) | Product vision, the four surfaces, design tokens, the locked invariants |
| [`specs/agent-rules.md`](./specs/agent-rules.md) | **The non-negotiable invariants — read before writing any code** |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | How the system actually fits together (pipeline, backend, frontend, data flows, testing) |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | How to run, seed, and test locally; deliberate deviations; the backlog |
| [`specs/`](./specs/) | The authoritative written specs — **read the relevant one before changing behavior** |

The `specs/` reading order is in `README.md` → "How this package is organized".
`specs/roadmap.md` defines the seven build phases (0–6) and their exit criteria;
phases 0–6 are implemented. `prototypes/*.dc.html` are **visual references only** —
recreate them in the real stack, never lift markup.

---

## Repository map

```
api/        FastAPI + SQLAlchemy backend (the data spine)   — detail: ARCHITECTURE.md §2
web/        React + TypeScript + Vite frontend              — detail: ARCHITECTURE.md §3
specs/      authoritative written specs (read to change behavior)
prototypes/ hi-fi HTML design references (open in a browser; do not copy)
screenshots/ static PNG captures of the four surfaces
dev.sh      one-command local runner (see DEVELOPMENT.md)
```

**Backend — `api/app/`** (full table in ARCHITECTURE.md §2):
- `models.py` — ORM entities (events, projections, structural, operational), dialect-agnostic
- `projections.py` — the event→projection pipeline + the metric/heat math (**the heart**)
- `scheduler.py` — pure SM-2 policy on a 0–3 score scale (no DB/clock)
- `scoring.py` — server-side answer assessment (the "AI" score; heuristic by default)
- `*_service.py` — read aggregations per surface; `routers/*` — thin FastAPI routers under `/api/v1`
- `schemas.py` — Pydantic DTOs, emitted as **camelCase**; `seed.py` — demo dataset
- `tests/` — pytest, against an in-memory SQLite engine (not mocks)

**Frontend — `web/src/`** (full table in ARCHITECTURE.md §3):
- `app/` — `router.tsx` (data router, `routes` exported for tests), `AppShell`, `Sidebar`
- `features/<surface>/` — one folder per surface: `queries.ts`, `types.ts`, page + components
  (`dashboard`, `concept`, `review`, `graph`, plus `subjects`, `settings`, `preferences`)
- `lib/` — `api.ts`, `heat.ts`, `queryClient.ts`, `format.ts`, focus/motion hooks
- `components/` — shared primitives (`Card`, `HeatDot`, `Tex`, `ModeToggle`, `feedback`)
- `tokens/tokens.ts` — the design tokens; `*.test.tsx` colocated with sources (Vitest + jsdom)

---

## The seven locked invariants

From [`specs/agent-rules.md`](./specs/agent-rules.md). These must hold. **If a
request conflicts with one, stop and surface the conflict — do not weaken it.**
Where each is enforced is tabulated in `ARCHITECTURE.md` §5.

1. **Mastery is event-derived** via an idempotent, replayable projection.
2. **The UI reads only projection tables** — never a live scan of raw events.
3. **The AI assigns the score; there is no self-grading** — never render a
   score-selection control. The score is a quiet, read-only outcome.
4. **The Concept Page visualization is never tab-gated** and occupies real space.
5. **Graph layout is decoupled from knowledge** — positions in `graph_layouts`,
   relationships in `concept_relationships`; independent reads and writes.
6. **`prefers-reduced-motion` is honored everywhere** — the graph settles instantly.
7. **Heat is shown by label + dot, never color alone.**

---

## Run & test

```bash
./dev.sh                 # seeds on first run, starts API (:8000) + web (:5173); Ctrl-C stops both

# Backend (in-memory SQLite — no services needed)
cd api && .venv/bin/python -m pytest -q

# Frontend
cd web && npm test             # Vitest
cd web && npm run typecheck    # tsc -b --noEmit
cd web && npm run lint         # eslint
cd web && npm run build        # tsc --noEmit && vite build
```

No `ANTHROPIC_API_KEY` is required — scoring falls back to `heuristic-v1`, so the
full learn → review loop runs offline. Full detail and first-time setup in
[`DEVELOPMENT.md`](./DEVELOPMENT.md).

---

## House conventions

- **Read path is sacred.** Pages and queries read projection tables only. If a
  surface needs a number, it comes from a projection — never aggregate raw events
  in a router, service read, or component.
- **DTOs are camelCase.** Pydantic emits by alias (`to_camel`); the TS types in
  `features/*/types.ts` are the exact mirror. Keep them in sync.
- **Server state lives in TanStack Query**, never in `useState`. One core query
  per surface plus satellites; keys and stale times follow the per-surface spec.
  A learning metric never lives in local state.
- **Models stay dialect-agnostic** — Python-generated UUIDs, `DateTime(timezone=True)`,
  portable enums; coerce naive datetimes with `ensure_utc` and aggregate in Python,
  not in dialect-specific SQL.
- **Tests run against a real engine** (in-memory SQLite backend, real `QueryClient` +
  stubbed `fetch` frontend). Mock only the app's own network boundary. Write tests
  with the change, covering the logic — not just the happy path.
- **Comments explain *why*.** Match the surrounding density and the existing
  "explain the intent" docstring style; don't narrate the obvious.
- **Stay calm / low-density** when a tradeoff pits information density against the
  product's reflective goals, unless the canonical variation says otherwise.

### Git

- The working branch is **`master`** (the repo's history lives there, not `main`).
- **Commit or push only when asked.** End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- `.env` and `api/*.db` are gitignored; never commit secrets or the dev database.

---

## Deliberate deviations & gotchas

Each is a documented swap-in point, not a weakened invariant (full notes in
`DEVELOPMENT.md` → "Deliberate deviations"):

- **SQLite for dev/test, PostgreSQL for prod.** Set `DATABASE_URL` to a Postgres
  DSN; nothing else changes.
- **Heuristic review scoring** when no model key is set. The score is still
  AI-assigned and read-only — invariant #3 holds either way.
- **List virtualization is deferred** (spec gates it at ~50 rows; the seed has 4).
- **Subjects & Settings pages are intentionally minimal** — added to fix dead
  sidebar links, not part of the original four-surface spec. See the backlog.
