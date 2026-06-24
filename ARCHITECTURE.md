# Cerebra — Architecture

How the system fits together. For the product vision and the authoritative
component specs see [`README.md`](./README.md) and [`specs/`](./specs/); for how
to run and test it locally see [`DEVELOPMENT.md`](./DEVELOPMENT.md).

Cerebra is a personal learning operating system built on one idea: **mastery is
not stored, it is derived.** Nothing writes a mastery number. The learner produces
*events* (recalls, problem attempts, explanations); a deterministic, replayable
projection folds those events into the metrics and schedules the UI reads. Every
surface is a view over projection tables — never a live scan of raw events.

```
  api/        FastAPI + SQLAlchemy backend (the data spine)
  web/        React + TypeScript + Vite frontend (four surfaces)
  specs/      authoritative written specs (read these to change behavior)
  prototypes/ hi-fi HTML design references
  screenshots/ static captures of the surfaces
  dev.sh      one-command local runner (see DEVELOPMENT.md)
```

---

## 1. The central pattern: event sourcing → projections → reads

```
   WRITES                         PROJECTION (idempotent, replayable)          READS
 ─────────────────────────      ───────────────────────────────────      ──────────────────
  recall_events        ┐         run_projection(concept):                  concept_metrics ┐
  problem_attempts     ├──load──▶  compute_schedule()  (SM-2 fold)  ──┐     review_schedule ├─▶ services ─▶ API ─▶ UI
  explanation_events   ┘           compute_metrics()   (blend)       ├──▶  recall_states    │   (read-only DTOs,
                                  upsert projection rows  ◀──────────┘     metric_snapshots ┘    camelCase)
       (immutable, append-only)            run_all_projections() · regenerate_snapshots()
```

- **Event tables** (`recall_events`, `problem_attempts`, `explanation_events`) are
  immutable and append-only. They are the only source of truth.
- **The projection** (`api/app/projections.py`) loads a concept's events and
  derives everything: it folds SM-2 over the recall log, computes recency-weighted
  metrics, and **upserts** the projection rows. It is idempotent — drop the
  projection tables, replay, and you get byte-identical state.
- **Projection tables** are what every read touches:
  - `concept_metrics` — mastery, retention, recall/problem accuracy, heat, review count
  - `review_schedule` — next due date, interval, ease, repetitions (the SM-2 state)
  - `recall_states` — the latest outcome per *prompt* (for the recall card)
  - `metric_snapshots` — a daily all-up rollup time series (retention trend)
- **Services** (`*_service.py`) aggregate projection rows into DTOs; **routers**
  expose them under `/api/v1`. No router or query aggregates raw events.

This pattern is invariant #1–2 (see §5) and is why the read path can cache freely:
projections only change when the projection job runs (after a review).

---

## 2. Backend (`api/app`)

### Layout

| File | Responsibility |
|---|---|
| `db.py` | Dialect-agnostic engine + session factory; `get_db` request dependency |
| `config.py` | Env-driven settings (SQLite + no model key by default) |
| `enums.py` | Shared `str` enums (relationship type, heat state, explanation direction) |
| `models.py` | The ORM entities — events, projections, structural, operational |
| `scheduler.py` | Pure SM-2 policy (0–3 scale), no DB/clock |
| `projections.py` | The event→projection pipeline + the metric/heat math |
| `scoring.py` | Server-side answer assessment (the "AI" score; heuristic default) |
| `*_service.py` | Read aggregations / orchestration per surface |
| `routers/*` | Thin FastAPI routers, all mounted under `/api/v1` |
| `seed.py` | Demo dataset + `python -m app.seed` entrypoint |
| `schemas.py` | Pydantic DTOs, emitted as camelCase |

### Dialect-agnostic models

Models run unchanged on SQLite (dev/test) and PostgreSQL (prod): UUID primary
keys are Python-generated (`uuid4`), timestamps are `DateTime(timezone=True)`, and
enums are stored as portable VARCHAR + CHECK (`models._enum`). SQLite drops tz
info, so reads coerce naive datetimes back to UTC via `projections.ensure_utc`,
and time-window filtering happens in Python rather than in dialect-specific SQL.

### SM-2 scheduling (`scheduler.py`)

A pure function over a frozen dataclass — exhaustively unit-testable. The classic
SM-2 is adapted to Cerebra's **0–3** score scale (`q`: 0 Forgot · 1 Partial ·
2 Mostly · 3 Perfect):

- `q ≤ 1` → failed recall: reset repetitions, interval = 1 day.
- else interval = 1 (rep 1), 6 (rep 2), `round(prev_interval × ease)` after.
- ease update: `ease += 0.1 − (3−q)·(0.08 + (3−q)·0.02)`, floored at `1.3`.
- `stability = interval × ease` feeds the retention estimate.

### The metric blend (`projections.compute_metrics`)

All inputs are **recency-weighted** with a 30-day half-life (`w = e^(−λ·age)`,
`λ = ln2/30`), so old evidence fades:

```
recall_accuracy   = recencyAvg(score/3 over recall events)
problem_accuracy  = recencyAvg(correct|partial over problem attempts)
retention         = exp(−days_since_review / stability)        # from SM-2
mastery           = 0.45·recall_accuracy
                  + 0.25·problem_accuracy
                  + 0.30·retention
                  + capped Feynman-explanation bonus (≤ 0.05)   # clamped to [0,1]
```

**Heat** is derived, never stored independently. `derive_heat` applies a
deterministic precedence over the spec's overlapping bands (frozen if dormant
>180d or never reviewed; else mastered / hot / warm / cold). `heat_from_mastery`
maps an aggregate mastery to the same bands the client uses (85/70/50/25), and
`score_heat` maps a single recall score for the per-prompt `recall_states`.

### Scoring (`scoring.py`) — the AI assigns the score

The learner submits an answer; the server assigns a 0–3 score. The default
assessor is a **deterministic heuristic** over key-term coverage (`assessed_by =
"heuristic-v1"`), so the review loop runs with no external model and tests stay
hermetic. A real model call can swap in behind the same `assess_answer` signature
— the contract (answer in, score + rationale out) is unchanged. There is **no path
for the learner to set a score** (invariant #3).

---

## 3. Frontend (`web/src`)

### Surfaces and routing

Four primary surfaces plus two secondary pages, composed by a data router
(`app/router.tsx`). The global `AppShell` (52px sidebar + centered canvas) wraps
everything except Review, which is full-screen.

| Route | Surface | Loading |
|---|---|---|
| `/` | Dashboard (Study Desk) | eager |
| `/concepts/:id` | Concept Page (visualization-dominant) | **lazy** (KaTeX) |
| `/graph`, `/graph/:subjectId` | Knowledge Graph (constellation atlas) | **lazy** (React Flow) |
| `/review`, `/review/:sessionId` | Review (AI-graded) | **lazy** (KaTeX) |
| `/subjects` | Subjects index | eager |
| `/settings` | Settings (optional-mode toggles) | eager |
| `*` (in-shell) | calm 404 | eager |

The heavy bundles (React Flow ≈154 kB, KaTeX ≈258 kB) are **code-split per route**
via the router's `lazy`, so the Dashboard's initial download excludes both
(main bundle ≈267 kB). The route tree is exported as `routes` so tests can mount
it with `createMemoryRouter`.

### Server state — TanStack Query

One core query per surface plus satellites; query keys and stale times follow the
specs. All DTOs are the **camelCase mirror** of the backend (Pydantic emits by
alias). Reads are generous with `staleTime` because projections rarely change.

| Scope | Keys | Notes |
|---|---|---|
| Dashboard | `['dashboard', …]`, `['concepts','weak']`, `['subjects','progress']` | one key per card |
| Concept | `['concept', id]` (core) + `…,'recall' / 'deps' / 'insight'` | core ⨝ metrics |
| Review | `['review', id]` | immutable queue; assess is a mutation |
| Graph | `['graph', sid, 'layout' / 'nodes' / 'edges']`, `['subjects']` | merged client-side |
| Preferences | `['preferences']` | localStorage-seeded for flash-free first paint |

**Invalidation:** completing an assessment (`ReviewSession`) invalidates
`['concept', conceptId]` and `['dashboard']` — the server has already re-projected,
so the UI just refetches the affected projections.

### Local UI state

Server state never lives in `useState`; local state is purely presentational:

- **Review** runs a five-state `useReducer` machine (`review/reducer.ts`):
  `PROMPT → ANSWERING → SUBMITTING → ASSESSED → COMPLETE`. There is deliberately
  **no action that sets a score** — the score only arrives via `ASSESSED` — which
  keeps "no self-grading" auditable.
- **Graph** highlight/selection is local; positions come from the layout read and
  are persisted by a debounced PATCH. The dim/emphasize model is pure
  (`graph/graphModel.ts`: `computeActiveSet` precedence hover > search > weak >
  deps > none) and fully unit-tested.
- **Optional modes** (`features/preferences/useMode.ts`) read `['preferences']`,
  return `{ mode, setMode }`, and write through to `PATCH /preferences`
  optimistically (a preference is presentation, never a metric).

### Design system

Tokens live once in `tokens/tokens.ts` and `lib/heat.ts` (brand palette + the heat
scale). Surfaces (`index.css`: `.surface-paper/glass/floating/modal`) implement the
L0–L4 layering. `prefers-reduced-motion` is honored globally in CSS and reactively
via `usePrefersReducedMotion`. **Heat is always label + dot** (`components/HeatDot`),
never color alone.

---

## 4. Two data-flow walkthroughs

**A review answer becomes mastery:**

```
ReviewSession submits answer
  → POST /review/:id/assess
      → scoring.assess_answer()                 # AI assigns 0–3
      → append RecallEvent (immutable)
      → run_projection(concept)                 # SM-2 fold + metric blend
          → upsert concept_metrics, review_schedule, recall_states
      → regenerate_snapshots()                  # daily rollup
      → return read-only AssessResultOut (score, rationale, next interval, heat)
  → client invalidates ['concept', id] + ['dashboard']  → affected cards refetch
```

**The graph stays decoupled:** node positions (`graph_layouts`) and knowledge
(`concept_relationships`) are independent reads and writes. Dragging a node PATCHes
only its position (`pinned = true`) and never touches an edge; editing a
relationship never moves a node. Proven by `test_graph.py`
(`test_drag_persists_position_without_touching_relationships`).

---

## 5. The seven locked invariants — and where they're enforced

From `specs/agent-rules.md`. These must hold; surface a conflict rather than weaken one.

| # | Invariant | Enforced in |
|---|---|---|
| 1 | Mastery is event-derived via an idempotent, replayable projection | `projections.py` (`run_projection`, `regenerate_snapshots`) |
| 2 | The UI reads only projection tables — never live event scans | `*_service.py`, all `routers/*` |
| 3 | The AI assigns the score; no self-grading control | `scoring.assess_answer`; `review/reducer.ts` (no SET_SCORE); read-only `AssessmentReveal` |
| 4 | The Concept Page visualization is never tab-gated | `concept/VisualizationPanel.tsx` (always mounted); focus mode only enlarges it |
| 5 | Graph layout is decoupled from knowledge | `graph_service` (`get_layout`/`get_nodes`/`get_edges`/`patch_layout`); `test_graph.py` |
| 6 | `prefers-reduced-motion` honored everywhere | `index.css` media query; `usePrefersReducedMotion` (graph fit duration → 0) |
| 7 | Heat shown by label + dot, never color alone | `components/HeatDot.tsx`; graph node aria-labels; heat legend |

---

## 6. Testing

Both suites run against a **real database engine** (in-memory SQLite via
`StaticPool`), not mocks — only the app's own network boundary is stubbed.

- **Backend** (`api/tests`, pytest): the SM-2 policy and metric math are unit-tested
  as pure functions; the projection, services, routers, seed and graph
  decoupling have integration tests against a live session.
- **Frontend** (`web/src/**/*.test.tsx`, Vitest + jsdom): pure logic
  (`graphModel`, the review reducer, heat) is unit-tested; components and pages
  render with a real `QueryClient` and a stubbed `fetch`; `navigation.test.tsx`
  mounts the real route tree so every sidebar destination is guaranteed to resolve.

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for commands, the deliberate deviations
(SQLite-for-dev, heuristic scoring, deferred list virtualization), and the backlog.
