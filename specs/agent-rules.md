# Cerebra Agent Rules v1.0

Invariants for any agent (or contributor) implementing Cerebra. These are
non-negotiable constraints distilled from `product.md`, `architecture.md`,
`design-system.md`, `ui-wireframes.md`, and `roadmap.md`. When a request conflicts
with a rule here, stop and surface the conflict rather than silently breaking it.

## Product invariants
- Optimize for **concept mastery and long-term retention**, never course completion or
  streak-gaming. When a feature could be framed as either, choose the anti-gamified,
  "sanctuary" framing.
- Concepts are **first-class entities**. Knowledge is a **graph**, not a list or tree.
- Support **multiple subjects** from day one; never hardcode a single-subject assumption.

## Data invariants
- **Mastery is event-derived.** All metrics flow from the event log
  (`recall_events`, `problem_attempts`, `explanation_events`) through a projection job
  into `concept_metrics` and `review_schedule`.
- **UI reads only from projection tables.** Never aggregate raw events live in a page or
  query. If a page needs a number, it comes from a projection.
- Projections must be **idempotent and replayable** from the event log.
- **Graph layout is separated from knowledge.** Node positions live in `graph_layouts`;
  relationships live in `concept_relationships`. Never couple the two — moving a node must
  not change a relationship, and editing a relationship must not move a node.
- Scoring uses **SM-2** on `recall_events.score` ∈ {0 Forgot · 1 Partial · 2 Mostly
  Correct · 3 Perfect}.

## Review invariants
- **The learner produces an answer; the AI assigns the score.** There is **no
  self-grading.** Never render score-selection buttons.
- The score is surfaced as a **quiet read-only outcome** (heat dot + label + one-line
  rationale + next interval), never as a prominent or interactive control.
- The Review interface is **full-screen, no sidebar, fully keyboard-driven.**

## Design invariants (Earthy Glass)
- Theme values: **calm, focused, scholarly, reflective.** Reject visual noise, cockpit
  density where calm is the goal, and gamified flourishes.
- Use only the brand palette: Forest `#30433D` · Moss `#61715A` · Sage `#8D9C84` ·
  Clay `#B17457` · Sand `#D9C8A9` · Cream `#F5F1E8` · Charcoal `#1F2522`.
- **Heat encoding is global and consistent:** Mastered `#30433D` · Hot `#61715A` ·
  Warm `#D9C8A9` · Cold `#B17457` · Frozen muted charcoal `#6b6f6c`. One source of truth.
- Respect the **four-level surface system:** Paper Card (L1) · Glass Panel (L2) ·
  Floating (L3) · Modal (L4). Don't invent new elevation tiers.
- **Global shell:** 52px icon-only sidebar, Forest, hover-expand; Cream (L0) canvas;
  1400px centered content. Review is the only page without the shell.

## Concept Page invariants
- **Visualizations are never hidden behind tabs** and must occupy significant screen
  space. Do not collapse, defer, or tab-gate the `VisualizationPanel`.

## Knowledge Graph invariants
- It is a **living atlas of understanding**, not a developer dependency graph. Nodes are
  circular, sized by importance, colored by heat; edges subtle and emphasized only on
  interaction. Avoid toolbar-heavy "dev tool" framing as the default.

## Motion & accessibility invariants
- Motion tokens only: **Fast 150ms** (reveal/hover) · **Normal 250ms** (reposition/panel).
  **No bounce or elastic.**
- Every interactive control needs a **visible focus state.** Review must be fully
  keyboard-operable.
- Honor **`prefers-reduced-motion`** — the graph settles instantly, transitions are cut.
- All mathematical notation renders via **KaTeX** — never images of equations.
- **Empty states teach** rather than show generic placeholders.

## Stack invariants
- Frontend: **React + TypeScript + Vite + Tailwind + React Flow + TanStack Query.**
- Backend: **FastAPI + PostgreSQL + SQLAlchemy.**
- Component names in code map to the names used in `ui-wireframes.md` and the Technical
  Architecture Frontend Structure. Keep them in sync.

## When in doubt
- Prefer the **calm / low-density** option (the wireframes' Variation C instincts) when a
  tradeoff pits information density against the product's reflective emotional goals,
  unless the selected canonical variation says otherwise.
- Surface conflicts and ambiguities to a human; do not resolve an invariant violation by
  weakening the invariant.
