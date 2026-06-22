# Handoff: Cerebra — Personal Learning Operating System

## Overview
Cerebra is a personal learning operating system focused on **concept mastery and long-term
retention** — not course completion or streak-gaming. Knowledge is modeled as a **graph of
concepts**; mastery is **derived from a log of learning events** (recall, problems,
explanations) via spaced repetition (SM-2). The product has four primary surfaces:
**Dashboard**, **Concept Page**, **Review Interface**, and **Knowledge Graph**.

This package contains the complete design system, four hi-fi surfaces, and a phase-by-phase
implementation specification (Phases 0–6) sufficient to build the product end to end.

## About the Design Files
The `.dc.html` files in `prototypes/` are **design references created in HTML** — interactive
prototypes showing the intended look and behavior. **They are not production code to copy
directly.** The task is to **recreate these designs in the target codebase** using the stack
the specs prescribe (React + TypeScript + Vite + Tailwind + TanStack Query + React Flow +
KaTeX; FastAPI + PostgreSQL + SQLAlchemy on the backend). If no codebase exists yet, scaffold
one per **Phase 0** (`specs/foundations.md`).

> The `.dc.html` files are authored in a small component framework and rely on `support.js`
> (included). Open them in a browser to view; treat them as visual + behavioral reference,
> not as a source to lift markup from.

## Fidelity
**High-fidelity.** The four product surfaces are pixel-level mockups with final colors,
typography, spacing, and working interactions (the Concept Page visualization is live; the
Knowledge Graph pans/zooms/filters). Recreate the UI faithfully using the codebase's
libraries. The seven **spec companion** pages and their markdown counterparts are the
authoritative source for component structure, data bindings, and behavior.

## How this package is organized
- **`specs/`** — the authoritative implementation specs. **Start here.** Read in order:
  1. `product.md`, `architecture.md`, `design-system.md` — vision, principles, visual system
  2. `agent-rules.md` — **non-negotiable invariants** (read before writing any code)
  3. `roadmap.md` — the seven phases and their exit criteria
  4. `foundations.md` (P0) → `data-architecture.md` (P1) → `dashboard-frontend.md` (P2) →
     `concept-page-frontend.md` (P3) → `review-frontend.md` (P4) → `graph-frontend.md` (P5) →
     `polish-frontend.md` (P6) — per-phase detail: component trees, data bindings, query
     keys, state models, loading/empty/error states, exit criteria
  5. `ui-wireframes.md` — low-fi layout exploration + the chosen variations
- **`prototypes/`** — the HTML design references (hi-fi surfaces + spec visual companions +
  index). Open `Cerebra Index.dc.html` first — it links everything.
- **`screenshots/`** — static PNG captures of the surfaces for quick offline reference:
  `00-index.png`, `01-dashboard.png`, `02-concept-page-and-review.png`,
  `03-knowledge-graph.png`. (Reference only — the interactive `.dc.html` files are authoritative.)

## The locked invariants (from `specs/agent-rules.md`)
These must hold in the implementation. Do not weaken them to satisfy a feature request —
surface the conflict instead.

1. **Mastery is event-derived.** All metrics flow from the event log (`recall_events`,
   `problem_attempts`, `explanation_events`) through an **idempotent, replayable projection
   job** into `concept_metrics` and `review_schedule`.
2. **The UI reads only projection tables.** Never aggregate raw events live in a page or query.
3. **The learner produces an answer; the AI assigns the score. There is no self-grading** —
   never render a score-selection control. The score is a quiet, read-only outcome.
4. **The Concept Page visualization is never tab-gated** and occupies significant space.
5. **Graph layout is decoupled from knowledge** — positions live in `graph_layouts`,
   relationships in `concept_relationships`; the two are independent reads and writes.
6. **`prefers-reduced-motion` is honored everywhere** — the graph settles instantly.
7. **Heat is shown by label + dot, never color alone.**

## Chosen direction
**Dashboard A · Concept A · Review A · Graph B** (the "Study Desk" dashboard,
visualization-dominant concept page, AI-graded review, living-atlas graph). Optional alternate
modes (Concept C focus, Graph A immersive, Review C tutor tone) ship behind toggles, default
off — see `specs/polish-frontend.md`.

---

## Screens / Views
Full component-level detail (layout, bindings, query keys, states) is in the per-phase spec
for each surface. Summary:

### 1. Dashboard — `prototypes/Cerebra Dashboard.dc.html` · spec `specs/dashboard-frontend.md`
- **Purpose:** daily home — what's due, what's weak, overall learning health.
- **Layout:** global shell (52px Forest sidebar + Cream canvas, 1400px centered); two-column
  grid 1.62fr / 1fr. Main: DueReviewsHero, WeakConcepts, RetentionTrends. Rail: LearningHealth
  (glass L2), KnowledgeHeatMap, SubjectProgress.
- **Data:** six TanStack Query keys under the `['dashboard', …]` scope, all reading projection
  tables. Completing a review invalidates the scope.

### 2. Concept Page — `prototypes/Cerebra Concept Page.dc.html` · spec `specs/concept-page-frontend.md`
- **Purpose:** master one concept — understand, visualize, recall, see dependencies.
- **Layout:** ConceptHeader + 4-card ConceptMetricsBar + **always-visible** VisualizationPanel
  (~40% viewport) + two-column body (Intuition/Definition/Notes | Recall/Problems/Dependencies/
  AIInsights).
- **Data:** one core query `['concept', id]` (concept ⨝ metrics) + satellites for recall, deps,
  insight. All math via KaTeX.

### 3. Review Interface — `prototypes/Cerebra Concept Page.dc.html#review` · spec `specs/review-frontend.md`
- **Purpose:** spaced-repetition recall — the learner answers, the AI scores.
- **Layout:** full-screen, **no sidebar**, 660px column. ProgressIndicator → Prompt →
  AnswerArea → (submit) → ModelAnswer + **read-only** AIAssessmentBar → Continue.
- **Behavior:** five-state session machine; the assess mutation appends a `recall_event`, runs
  SM-2, updates projections, and returns the score read-only. Fully keyboard-driven.

### 4. Knowledge Graph — `prototypes/Cerebra Knowledge Graph.dc.html` · spec `specs/graph-frontend.md`
- **Purpose:** the living atlas — navigate concepts, trace learning paths, spot weak areas.
- **Layout:** full-canvas React Flow; circular nodes sized by importance, colored by heat, over
  named regions; L2 glass controls (search, filters, zoom, legend); L3 floating inspector.
- **Data:** nodes (layout ⨝ metrics), edges (relationships) merged client-side; layout drag
  persists to `graph_layouts` without touching relationships.

---

## Design Tokens (from `specs/design-system.md` + `specs/foundations.md`)

**Theme:** Earthy Glass — calm, focused, scholarly, reflective.

**Colors**
| Token | Hex | Role |
|---|---|---|
| forest | `#30433D` | primary dark surface; mastered |
| moss | `#61715A` | secondary; hot |
| sage | `#8D9C84` | muted accent, labels |
| clay | `#B17457` | warning; cold |
| sand | `#D9C8A9` | warm highlight; warm |
| cream | `#F5F1E8` | L0 canvas / paper |
| charcoal | `#1F2522` | body text |

**Heat scale (single source of truth)** — `heatState(mastery 0–100) → color`:
mastered ≥85 `#30433D` · hot ≥70 `#61715A` · warm ≥50 `#D9C8A9` · cold ≥25 `#B17457` ·
frozen <25 `#6b6f6c`. Always paired with a text label.

**Surfaces** — L0 canvas (cream, flat) · L1 paper (`#FBF9F3`, 1px forest/14, radius 10–11,
shadow `0 1px 3px rgba(31,37,34,.05)`) · L2 glass (white/cream gradient + 20px blur) · L3
floating (white, radius 13, `0 6px 22px rgba(31,37,34,.10)`) · L4 modal (white on charcoal/40
scrim, `0 24px 60px rgba(31,37,34,.28)`).

**Typography** — display: Newsreader (serif, 500) · body: Hanken Grotesk (400/600) · mono:
JetBrains Mono (eyebrow labels, metrics). Scale and usage in `specs/foundations.md` §6. Math is
KaTeX, never type or images.

**Motion** — fast 150ms (reveal/hover) · normal 250ms (reposition/panel) · ease
`cubic-bezier(.4,0,.2,1)`. No bounce. Honor `prefers-reduced-motion`.

**Layout** — 52px icon-only Forest sidebar (hover-expand); 1400px centered content; Review is
the only surface without the shell.

## State Management
Per surface: server state in **TanStack Query** (one core query + satellites), local UI state in
`useState`/`useReducer`, never a learning metric in local state. Review owns a `useReducer`
session machine. Graph viewport is React Flow internal; highlight/selection is local. Exact
query keys, stale times, and invalidation rules are in each phase's frontend spec.

## Data model
Nine entities + two phase-added tables (`metric_snapshots` P2, `concepts.viz_spec` P3).
Column-level schema, the event→projection pipeline, and SM-2 (0–3 adaptation) are fully
specified in `specs/data-architecture.md`. Visual: `prototypes/Cerebra Data Architecture.dc.html`.

## Assets
No external image or icon assets — all iconography in the prototypes is inline SVG, and all
visualizations are code-drawn (SVG / React Flow). Fonts load from Google Fonts (Newsreader,
Hanken Grotesk, JetBrains Mono). KaTeX loads from CDN in the prototypes; bundle it in production.
No third-party brand assets are used.

## Files
- `prototypes/Cerebra Index.dc.html` — entry point; links every surface and spec
- `prototypes/Cerebra Dashboard.dc.html` — Dashboard (Variation A)
- `prototypes/Cerebra Concept Page.dc.html` — Concept Page + Review (Variation A)
- `prototypes/Cerebra Knowledge Graph.dc.html` — Knowledge Graph (Variation B)
- `prototypes/Cerebra Prototype.dc.html` — linked walkthrough home
- `prototypes/Cerebra UI Wireframes.dc.html`, `Cerebra Graph States.dc.html`,
  `Cerebra Analysis.dc.html` — supporting studies
- `prototypes/Cerebra Foundations.dc.html` … `Cerebra Polish Frontend Spec.dc.html` — the seven
  spec visual companions
- `prototypes/support.js` — runtime required to open the `.dc.html` files
- `specs/*.md` — the authoritative written specifications (read these to implement)
