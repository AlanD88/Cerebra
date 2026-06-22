# Cerebra Frontend Spec — Phase 2 · Dashboard v1.0

Companion to `roadmap.md` (Phase 2 — Dashboard, Variation A "Study Desk"),
`data-architecture.md` (the projection tables this page reads), and `agent-rules.md`.
Maps the existing hi-fi Dashboard surface to a concrete React + TypeScript + TanStack
Query implementation: component tree, data bindings, query keys, state model, and
loading / empty / error states.

Visual companion: `Cerebra Dashboard Frontend Spec.dc.html`.

**Two rules govern everything here**
1. **Projections only.** Every number on the Dashboard comes from `concept_metrics`,
   `review_schedule`, or `metric_snapshots` (§7). The client never aggregates raw events,
   and never recomputes mastery/retention locally.
2. **Server state vs UI state.** Server state lives in TanStack Query (six keys, §4).
   Local UI state (hover index, sidebar expand) lives in `useState` and never enters the
   query cache.

---

## 1. Component tree

Route `/` (Variation A — Study Desk). Source binding in brackets.

```
DashboardPage                                  route "/"
└─ AppShell                                    layout · sidebar + cream canvas
   ├─ Sidebar                                  static nav (no data)
   ├─ DashboardHeader                          local: greeting, dateLine
   │  └─ StreakBadge                           ← review_schedule (streak agg)
   └─ DashboardGrid                            1.62fr / 1fr
      ├─ MainColumn
      │  ├─ DueReviewsHero                     ← review_schedule
      │  ├─ WeakConcepts                       ← concept_metrics
      │  └─ RetentionTrends                    ← metric_snapshots
      └─ RightRail
         ├─ LearningHealth                     ← concept_metrics (aggregate)
         ├─ KnowledgeHeatMap                   ← concept_metrics (grouped by subject)
         └─ SubjectProgress                    ← concept_metrics (aggregate by subject)
```

`AppShell`, `Sidebar`, `DashboardHeader`, `StreakBadge`, `DashboardGrid` are layout/presentational.
The six leaf data components each own exactly one query.

---

## 2. Data bindings

Each data component reads one projection source through one query. Shapes are the API
response contracts (camelCased server DTOs).

| Component | Source (projection) | Query key | Returns |
|---|---|---|---|
| `DueReviewsHero` | `review_schedule` | `['dashboard','due-summary']` | `{ total, overdue, dueToday, subjects }` |
| `WeakConcepts` | `concept_metrics` | `['dashboard','weak',{limit:5}]` | `Array<{ conceptId, name, subject, mastery, heatState }>` |
| `RetentionTrends` | `metric_snapshots` | `['dashboard','retention',{days:30}]` | `{ points: number[], reviews: {day,count}[] }` |
| `LearningHealth` | `concept_metrics` | `['dashboard','health']` | `{ avgMastery, retention, retentionDelta, tracked, subjects }` |
| `KnowledgeHeatMap` | `concept_metrics` | `['dashboard','heatmap']` | `Array<{ subject, cells: {conceptId,name,heatState,mastery}[] }>` |
| `SubjectProgress` | `concept_metrics` | `['dashboard','subject-progress']` | `Array<{ subjectId, name, avgMastery, heatState }>` |

All aggregates (`avgMastery`, `total`, `overdue`, heat grouping) are computed **server-side**
from projection rows — never in the component. `heatState` is the enum already stored on
`concept_metrics`; the client maps enum → color via the shared heat utility, nothing more.

---

## 3. API endpoints

Thin read endpoints over the projection tables. All `GET`, all idempotent.

```
GET /api/dashboard/due-summary        → DueReviewsHero      (review_schedule)
GET /api/concepts/weak?limit=5        → WeakConcepts        (concept_metrics ORDER BY mastery ASC)
GET /api/dashboard/retention?days=30  → RetentionTrends     (metric_snapshots)
GET /api/dashboard/health             → LearningHealth      (concept_metrics agg)
GET /api/dashboard/heatmap            → KnowledgeHeatMap    (concept_metrics grouped)
GET /api/subjects/progress            → SubjectProgress     (concept_metrics agg by subject)
```

No endpoint touches `recall_events` / `problem_attempts` / `explanation_events`. If a value
isn't in a projection, the fix is to project it (§7) — not to aggregate events in the read path.

---

## 4. Query layer (TanStack Query)

Projections only change when the projection job runs (after a review, Phase 4). Reads can
therefore be generous with `staleTime`. Shared defaults via `QueryClient`:

```ts
defaultOptions: {
  queries: {
    staleTime: 60_000,            // projections are stable between job runs
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,   // pick up a projection that ran while away
    retry: 2,
    placeholderData: keepPreviousData,  // no flash on refetch
  }
}
```

Per-key notes:

| Query key | staleTime | Notes |
|---|---|---|
| `['dashboard','due-summary']` | 30s | most time-sensitive (overdue counts drift) |
| `['dashboard','weak',{limit:5}]` | 60s | re-sorts after a review |
| `['dashboard','retention',{days:30}]` | 5m | snapshot table, daily granularity |
| `['dashboard','health']` | 60s | — |
| `['dashboard','heatmap']` | 60s | — |
| `['dashboard','subject-progress']` | 60s | — |

**Invalidation.** Completing a Review (Phase 4) emits a `recall_event` → projection job
runs → the review mutation's `onSuccess` calls
`queryClient.invalidateQueries({ queryKey: ['dashboard'] })`, refetching the whole page
scope at once. No optimistic dashboard updates — the projection is the source of truth, so
we wait for it rather than guessing.

---

## 5. State model

| | Where | Examples |
|---|---|---|
| **Server state** | TanStack Query cache | the six query keys in §4 |
| **Local UI state** | `useState` in the component | `chartHoverIndex` (RetentionTrends), `heatHoverLabel` (KnowledgeHeatMap), `sidebarExpanded` (Sidebar), `greeting`/`dateLine` (DashboardHeader, from `Date`) |

Hover/interaction state is purely local and never persisted or cached. Nothing in local
state is a learning metric — metrics are exclusively server-derived.

---

## 6. Loading / empty / error states

Per `agent-rules.md`, empty states **teach** rather than show a generic placeholder.

| Component | Loading | Empty |
|---|---|---|
| `DueReviewsHero` | skeleton count + CTA | "Nothing due — your schedule is clear. Explore the graph or add a concept." |
| `WeakConcepts` | 5 shimmer rows | "Start reviewing to surface what you're forgetting." |
| `RetentionTrends` | skeleton chart band | "Trends appear after a few days of review." |
| `LearningHealth` | skeleton ring | "Add your first concept to begin tracking learning health." |
| `KnowledgeHeatMap` | skeleton cell grid | "Create concepts to build your knowledge heat map." |
| `SubjectProgress` | 3 shimmer bars | "No subjects yet — create one to get started." |

**Error** — each card renders an inline, non-blocking error with a Retry that calls
`refetch()` for that query only; one card failing never blanks the page. Mutation failures
(Review) surface as a toast, never as a dashboard error.

**Motion** — card reveal uses Fast (150ms) fade/translate; honor `prefers-reduced-motion`
(no transform, instant). No skeleton-to-content layout shift: skeletons reserve final height.

---

## 7. Schema note — `metric_snapshots` (Phase 2 addition)

`RetentionTrends` needs a 30-day time series, but `concept_metrics` holds only the current
point-in-time value. Recomputing history from events would violate Rule 1. **Add a daily
projection table** written by the same projection job:

**`metric_snapshots`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → `subjects.id`; nullable for all-subjects rollup |
| `concept_id` | uuid | FK → `concepts.id`; nullable for subject rollup |
| `as_of` | date | snapshot day |
| `mastery` | real | 0–1 |
| `retention` | real | 0–1 |
| `reviews` | int | reviews completed that day |
| — | — | UQ (`concept_id`, `subject_id`, `as_of`) |

Still a projection (idempotent, replayable from the event log), still off the read-path
event aggregation rule. Append this to the Phase 1 entity set when Phase 2 starts.

---

## 8. Phase 2 exit criteria

The Dashboard renders entirely from projection queries; all six cards have working loading,
empty, and error states; completing a (stubbed) review invalidates `['dashboard']` and the
counts update; no component aggregates raw events or holds a learning metric in local state.
