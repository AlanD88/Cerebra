# Cerebra Frontend Spec — Phase 5 · Knowledge Graph v1.0

Companion to `roadmap.md` (Phase 5 — Knowledge Graph, Variation B "living atlas"),
`data-architecture.md` (the graph + layout tables), `foundations.md` (heat + motion tokens),
and `agent-rules.md`. Maps the graph surface to a concrete React + TypeScript + React Flow
implementation.

Visual companion: `Cerebra Graph Frontend Spec.dc.html`.

**The locked invariants**
1. **It is a living atlas, not a dependency graph.** Circular nodes sized by importance,
   colored by heat; edges subtle, emphasized only on interaction; named regions/clusters.
   No toolbar-heavy "dev tool" framing.
2. **Layout is decoupled from knowledge.** Positions live in `graph_layouts`; relationships
   live in `concept_relationships`. Moving a node never edits a relationship; editing a
   relationship never moves a node. They are two independent reads and two independent writes.
3. **`prefers-reduced-motion` ⇒ the graph settles instantly** — no animated layout, no
   transition on highlight.

---

## 1. Component tree

Route `/graph` (and `/graph/:subjectId`). Inside `AppShell`; the canvas fills the content area.

```
GraphPage                                      route "/graph"
└─ AppShell                                    shared shell (sidebar + canvas)
   └─ GraphCanvas        (React Flow)          ← nodes (layout⨝metrics) + edges (relationships)
      ├─ ConceptNode  × N    custom node       circular · sized by importance · heat fill
      ├─ ConceptEdge  × M    custom edge        subtle; emphasized when both ends in active set
      ├─ RegionLayer         background         named clusters (Vectors, Eigen, SVD…)
      ├─ SearchField   (L2 glass, top-left)     local query → highlight set
      ├─ FilterChips   (top-right)              "Highlight weak" · "Dependency path"
      ├─ ZoomControls  (L2 glass, bottom-left)  + / − / fit
      ├─ HeatLegend    (L2 glass, bottom)       static heat key
      └─ ConceptInspector (L3 floating, right)  ← selected concept + prereqs + learning path
```

`GraphCanvas` owns viewport (pan/zoom) and the active-highlight computation. `ConceptNode`
and `ConceptEdge` are pure given their props. `ConceptInspector` is the only L3 surface.

---

## 2. Data bindings — two independent reads

The defining structural point: **nodes and edges come from different tables, joined only on
the client.**

| Concern | Source | Query key | Returns |
|---|---|---|---|
| **Node positions** | `graph_layouts` | `['graph', subjectId, 'layout']` | `[{ conceptId, x, y, pinned }]` |
| **Node heat/size** | `concept_metrics` + `concepts.importance` | `['graph', subjectId, 'nodes']` | `[{ conceptId, name, importance, heatState, mastery }]` |
| **Edges** | `concept_relationships` | `['graph', subjectId, 'edges']` | `[{ source, target, type, strength }]` |
| **Inspector** | `concepts` + `concept_metrics` | `['concept', id]` (reused from Phase 3) | `{ name, subject, mastery, retention, heatState, prereqs[] }` |

A `useGraphModel(subjectId)` hook fetches layout + nodes + edges and merges them into React
Flow's `{ nodes, edges }` shape: position from `graph_layouts`, data (heat, size, label) from
the nodes query, edges from relationships. Heat enum → color via the shared utility (Phase 0).
The inspector reuses the Phase 3 `['concept', id]` query — selecting a node warms that cache.

---

## 3. Layout writeback — decoupled from relationships

| User action | Writes | Never touches |
|---|---|---|
| Drag a node | `PATCH /graph/:subjectId/layout` → `graph_layouts {x,y,pinned:true}` | `concept_relationships` |
| Add/remove a prerequisite | `POST/DELETE /concepts/:id/relationships` → `concept_relationships` | `graph_layouts` |
| "Auto-arrange" | recompute unpinned positions → `graph_layouts` | `concept_relationships` |

Drag persists position only (debounced PATCH, optimistic local position update — position is
presentation, so optimism is safe here, unlike metrics). `layout_version` allows multiple
saved arrangements. **Editing the knowledge graph and editing the visual layout are separate
mutations with separate invalidation** — `'layout'` vs `'edges'` keys.

---

## 4. Interaction model

All six required behaviors, and where each lives:

| Behavior | Implementation | State |
|---|---|---|
| **Zoom** | wheel + ZoomControls; clamp 0.55–2.6 | viewport (React Flow) |
| **Pan** | background drag | viewport |
| **Search** | substring match → `highlightSet` | local `search` |
| **Highlight Dependencies** | hover/select → `neighbors(id)` set | local `hoverId` |
| **Highlight Weak Concepts** | filter `heatState ∈ {cold,frozen}` | local `filter='weak'` |
| **Show Learning Paths** | `ancestors(selected)` prerequisite walk | local `filter='deps'` |

The **active set** is computed once per render (`hover > search > weak-filter > dep-path >
none`). Nodes/edges outside the set dim; edges with both ends inside emphasize. This is the
"emphasized only on interaction" rule — at rest, everything is calm and low-contrast.

`ancestors()` and `neighbors()` are derived from the **edges** data (relationships), never
from layout. The learning path is a transitive prerequisite walk surfaced both on-canvas
(highlight) and in the inspector ("Show learning path").

---

## 5. State model

| | Where | Examples |
|---|---|---|
| **Server state** | TanStack Query | the four keys in §2 |
| **Viewport** | React Flow internal | `{ x, y, zoom }` (pan/zoom) |
| **Local UI state** | `useState` in `GraphCanvas` | `selected`, `hoverId`, `search`, `filter` |
| **Derived** | render | active highlight set, dimmed nodes, emphasized edges, inspector prereqs |

Highlight/selection is **purely local** — it never enters the cache and never persists.
Node *position* is the one interaction that writes back (to `graph_layouts`, §3).

---

## 6. Performance

- **Virtualize** offscreen nodes for large graphs (React Flow `onlyRenderVisibleElements`).
- Memoize `ConceptNode`/`ConceptEdge` (`React.memo`) — keyed by `{heat, dimmed, selected}` so
  a hover only re-renders affected nodes.
- Compute the active set once per render, not per node.
- Debounce drag-to-layout PATCH (~400ms after drag end).
- Cache the merged graph model; invalidate `'layout'` only on drag, `'edges'` only on
  relationship edits — never refetch the whole model on a hover.

---

## 7. Motion & accessibility

- **`prefers-reduced-motion` ⇒ settle instantly:** no animated auto-layout, no transition on
  node dim/emphasize, fit-to-view jumps rather than tweens.
- Otherwise highlight transitions use Fast (150ms) opacity; viewport changes use Normal
  (250ms). No bounce.
- Nodes are keyboard-focusable (Tab order by importance); Enter opens the inspector; arrow
  keys nudge a focused node's layout. Visible focus ring on the focused node.
- The inspector is a focus trap while open; Esc closes and returns focus to the node.

---

## 8. Loading / empty / error states

| Surface | Loading | Empty |
|---|---|---|
| `GraphCanvas` | skeleton constellation (faint dots) | "No concepts yet — create some to grow your atlas." |
| `ConceptInspector` | n/a (opens only on a loaded node) | — |
| Search | — | "No concepts match." inline under the field |
| Dependency path | — | "This concept is foundational — no prerequisites." in inspector |

**Error** — a layout/nodes/edges fetch failure shows a centered "Couldn't load the graph" +
Retry; a single failed inspector query shows an inline error in the panel without closing it.

---

## 9. Phase 5 exit criteria

Navigating (pan/zoom/search), selecting, and pathfinding all work; nodes are heat-colored and
importance-sized over named regions; the inspector shows live prerequisites with heat and a
working learning-path trace; dragging a node persists to `graph_layouts` and survives reload
**without** altering any relationship; `prefers-reduced-motion` settles the graph instantly.
