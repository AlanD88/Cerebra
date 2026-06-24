# CLAUDE.md

Project guidance for Claude Code working in **Cerebra**. The full orientation
lives in [`AGENTS.md`](./AGENTS.md) — read it first.

@AGENTS.md

---

## The one-line model

Mastery is **derived, not stored.** Events → an idempotent projection →
projection tables → read-only DTOs → UI. Never write a mastery number; never read
raw events from a page or query.

## Before you change behavior

1. Open the relevant spec in [`specs/`](./specs/) — it is authoritative.
2. Re-check the **seven invariants** in [`specs/agent-rules.md`](./specs/agent-rules.md)
   (summarized in `AGENTS.md`). If your task conflicts with one, **stop and surface
   the conflict** rather than weakening it.
3. For how a piece fits together, read [`ARCHITECTURE.md`](./ARCHITECTURE.md)
   before grepping — it has the pipeline, the math, and the data-flow walkthroughs.

## Working here

- **Match the house style.** Comments explain *why*; DTOs are camelCase mirrors;
  server state is TanStack Query, never `useState`; models stay dialect-agnostic.
  Conventions are listed in `AGENTS.md` → "House conventions".
- **Write tests with the change.** Both suites run against a real engine (in-memory
  SQLite backend; real `QueryClient` + stubbed `fetch` frontend). Mock only the
  app's own network boundary.
- **Verify before claiming done.** Run the suite for the side you touched:
  - backend: `cd api && .venv/bin/python -m pytest -q`
  - frontend: `cd web && npm test && npm run typecheck && npm run lint`
- Report outcomes faithfully — if tests fail, say so with the output.

## Git

- The working branch is **`master`** (not `main`).
- **Commit or push only when the user asks.** End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- `.env` and `api/*.db` are gitignored — never commit secrets or the dev database.

## Open backlog

Tracked in [`DEVELOPMENT.md`](./DEVELOPMENT.md) → "Backlog / follow-ups":
flesh out the minimal Subjects/Settings pages; wire list virtualization once a
list realistically exceeds ~50 rows.
