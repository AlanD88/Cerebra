# Cerebra Frontend Spec — Phase 3 · Concept Page v1.0

Companion to `roadmap.md` (Phase 3 — Concept Page, Variation A, **highest priority**),
`data-architecture.md` (the tables this page reads), `dashboard-frontend.md` (shared query
conventions), and `agent-rules.md`. Maps the hi-fi Concept Page surface to a concrete
React + TypeScript + TanStack Query + KaTeX implementation.

Visual companion: `Cerebra Concept Page Frontend Spec.dc.html`.

**Three rules govern everything here**
1. **Projections only.** Metrics come from `concept_metrics`; the body (intuition,
   definition, notes) from `concepts`; dependencies from `concept_relationships` joined to
   `concept_metrics` for each neighbor's heat. The page never aggregates raw events.
2. **The visualization is never tab-gated.** `VisualizationPanel` is always mounted, full
   width, ~40% of viewport height. Do not collapse, defer, or hide it behind a tab
   (`agent-rules.md`).
3. **All math is KaTeX.** Never an image of an equation. One render pass on mount + on the
   live value changing.

---

## 1. Component tree

Route `/concepts/:conceptId` (Variation A — visualization-dominant). Source binding in brackets.

```
ConceptPage                                    route "/concepts/:id"
└─ AppShell                                    shared shell (sidebar + cream canvas)
   └─ ConceptLayout                            single scroll column, 1400px
      ├─ ConceptHeader                         ← concepts + concept_metrics
      │  ├─ HeatBadge                          ← concept_metrics.heat_state
      │  └─ ConceptActions                     "Practice recall" → /review · "Open in graph"
      ├─ ConceptMetricsBar                     ← concept_metrics  (4 stat cards)
      ├─ VisualizationPanel   ★ never tab-gated ← concepts.viz_spec (local interaction state)
      │  ├─ VizStage                           SVG/interactive · local vx,vy
      │  └─ VizReadout (glass L2)              KaTeX live computation
      └─ ConceptBody                           two-column grid 1.5fr / 1fr
         ├─ LeftColumn
         │  ├─ IntuitionCard                   ← concepts.intuition
         │  ├─ DefinitionCard                  ← concepts.definition (KaTeX)
         │  └─ NotesCard                        ← concepts.notes
         └─ RightColumn
            ├─ RecallCard                       ← review_schedule + recent recall projection
            ├─ ProblemsCard                     ← concept_metrics.problem_accuracy
            ├─ DependenciesCard                 ← concept_relationships + concept_metrics
            └─ AIInsightsCard                   ← /insights endpoint (tutoring model)
```

`AppShell`, `ConceptLayout`, `ConceptActions` are presentational. `VisualizationPanel` owns
local interaction state only (no server data beyond the static `viz_spec`).

---

## 2. Data bindings

| Component | Source | Query key | Returns (key fields) |
|---|---|---|---|
| `ConceptHeader` | `concepts` + `concept_metrics` | `['concept', id]` | `{ name, subject, breadcrumb, mastery, heatState, dueAt }` |
| `ConceptMetricsBar` | `concept_metrics` | `['concept', id]` (same) | `{ mastery, retention, recallAccuracy, problemAccuracy }` |
| `VisualizationPanel` | `concepts.viz_spec` | `['concept', id]` (same) | `{ vizSpec }` — static; interaction is local |
| `IntuitionCard` / `DefinitionCard` / `NotesCard` | `concepts` | `['concept', id]` (same) | `{ intuition, definition, notes }` |
| `RecallCard` | `review_schedule` + recall projection | `['concept', id, 'recall']` | `{ dueCount, items: [{prompt, lastScore, heatState}] }` |
| `ProblemsCard` | `concept_metrics` | `['concept', id]` (same) | `{ problemAccuracy, sample }` |
| `DependenciesCard` | `concept_relationships` ⨝ `concept_metrics` | `['concept', id, 'deps']` | `[{ conceptId, name, heatState, isRootWeakness }]` |
| `AIInsightsCard` | tutoring model | `['concept', id, 'insight']` | `{ summary, suggestedConceptId, cta }` |

**One core query, three satellites.** `['concept', id]` returns the concept record joined to
its `concept_metrics` row — it feeds the header, metrics bar, viz spec, and all three body
cards on the left in a single fetch. Recall, dependencies, and AI insight are separate keys
because they hit different sources and have different cadences.

`heatState` is the stored enum on `concept_metrics`; the client only maps enum → color via
the shared heat utility (Phase 0).

---

## 3. API endpoints

```
GET /api/concepts/:id                 → core: concepts ⨝ concept_metrics
GET /api/concepts/:id/recall          → review_schedule + recent recall_events projection
GET /api/concepts/:id/dependencies    → concept_relationships ⨝ concept_metrics (neighbor heat)
GET /api/concepts/:id/insight         → tutoring model (may be slow; own loading state)
```

`recall` reads a **projection** of recent recall outcomes (last-score per prompt), not a live
scan of `recall_events`. `dependencies` resolves each prerequisite's current `heat_state`
from `concept_metrics` and flags the lowest-mastery prerequisite as `isRootWeakness`.

---

## 4. Query layer

Inherits the Phase 2 `QueryClient` defaults (60s staleTime, keepPreviousData). Per-key:

| Query key | staleTime | Notes |
|---|---|---|
| `['concept', id]` | 60s | core record; re-fetched after a review of this concept |
| `['concept', id, 'recall']` | 30s | due counts drift; most time-sensitive |
| `['concept', id, 'deps']` | 5m | structure changes rarely |
| `['concept', id, 'insight']` | 10m | model call; cache aggressively, `retry: 1` |

**Invalidation.** Completing a review of this concept (Phase 4) invalidates
`['concept', id]`, `['concept', id, 'recall']`, **and** the `['dashboard']` scope — the
metrics bar, heat badge, and recall list all reflect the new projection. AI insight is *not*
auto-invalidated (expensive); it has a manual "Refresh insight" affordance.

---

## 5. State model

| | Where | Examples |
|---|---|---|
| **Server state** | TanStack Query | the four keys in §2 |
| **Local UI state** | `useState` in `VisualizationPanel` | `vx`, `vy` (dragged vector), `dragging`, `activePreset` |
| **Derived (render-time)** | `renderVals()` | `Av`, `aligned` eigen-direction, `statusColor`, live KaTeX string |

The visualization's interaction state is **purely local** — it never enters the query cache
and is never persisted as a metric. Dragging the vector computes `Av` and alignment on each
render; nothing about the interaction writes back to the server (exploration ≠ assessment).

---

## 6. KaTeX rendering

- Load `katex.min.css` + deferred `katex.min.js` once in the shell head.
- A `renderMath()` pass walks `[data-tex]` nodes on mount and marks each `data-rendered`
  so re-renders skip already-typeset nodes.
- The **live computation** readout re-renders every time `vx/vy` change (it is the one node
  intentionally re-typeset each frame). All other math typesets once.
- `throwOnError: false` — a bad expression degrades to source text, never a thrown render.
- Poll for `window.katex` on mount (deferred script) before the first pass.

---

## 7. Loading / empty / error states

Per `agent-rules.md`, empty states teach. The page must render the shell + visualization
frame immediately; data cards fill in.

| Component | Loading | Empty |
|---|---|---|
| `ConceptHeader` | skeleton title + badge | n/a (concept always exists on this route) |
| `ConceptMetricsBar` | 4 skeleton stat cards | "No reviews yet — practice recall to start tracking mastery." |
| `VisualizationPanel` | frame + spinner in stage; **chrome shown immediately** | static diagram if no interaction spec |
| `RecallCard` | 3 shimmer rows | "Nothing scheduled — you're caught up on this concept." |
| `ProblemsCard` | skeleton number | "No problems attempted yet." |
| `DependenciesCard` | 3 shimmer rows | "No prerequisites mapped — add relationships in the graph." |
| `AIInsightsCard` | "Analyzing your performance…" pulse | "Insight appears after a few reviews." |

**Error** — each satellite card renders an inline, non-blocking error + Retry (`refetch()`
for that key). A core `['concept', id]` failure shows a full-page "Couldn't load this
concept" with a back-to-graph link. The visualization frame never blanks the page.

**Motion** — card reveal uses Fast (150ms); honor `prefers-reduced-motion`. Skeletons
reserve final height (no layout shift). No bounce.

---

## 8. Schema note — `concepts.viz_spec`

`VisualizationPanel` needs a declarative description of the interactive diagram (matrix
presets, eigen-directions, guide visibility) so it isn't hardcoded per concept. Add a
nullable JSON column:

**`concepts.viz_spec`** `jsonb` — `{ kind, presets[], guides, ... }`; `null` ⇒ the panel
renders a static illustration or a "visualization coming soon" frame. Authored content, not
derived — lives with the concept record. Append to the Phase 1 `concepts` table when Phase 3
starts.

---

## 9. Phase 3 exit criteria

A seeded concept renders header, metrics bar, an always-visible interactive visualization,
and all body cards from projection/concept data; all math is KaTeX; dependencies show each
prerequisite's live heat with the root weakness flagged; completing a review updates the
metrics bar and recall list; the visualization is never hidden behind a tab.
