# Cerebra Implementation Roadmap v1.0

Companion to `product.md`, `architecture.md`, `design-system.md`, and
`ui-wireframes.md`. Sequences the build into phases with clear exit criteria.
Each phase is shippable on its own; later phases assume the data and surfaces of
earlier ones. Selected wireframe set is canonical: Dashboard **A** · Concept **A** ·
Review **A** · Graph **B**.

**Guiding principle:** build the data spine before the surfaces. Mastery is
event-derived, so the event → projection pipeline must exist before any page that
reads it. Pages read **only** from projection tables (`concept_metrics`,
`review_schedule`), never by aggregating raw events live.

---

## Phase 0 — Foundations
Scaffold and shared primitives. No user-facing pages yet.
- Vite + React + TypeScript + Tailwind project; Tailwind tokens wired to the seven
  brand colors and the four-level surface system (Paper L1 · Glass L2 · Floating L3 ·
  Modal L4).
- Heat-state utility (`Mastered/Hot/Warm/Cold/Frozen` → color) as a single source of truth.
- Motion tokens: Fast 150ms (reveal/hover) · Normal 250ms (reposition/panel). No bounce.
- KaTeX, React Flow, TanStack Query installed and smoke-tested.
- Global shell: 52px icon-only sidebar (Forest), hover-expand, Cream canvas, 1400px
  centered content.
**Exit:** shell renders, tokens resolve, a throwaway page proves a projection-table read.

## Phase 1 — Data spine
Backend entities and the event → projection pipeline.
- FastAPI + PostgreSQL + SQLAlchemy. Tables: `subjects`, `concepts`,
  `concept_relationships`, `recall_events`, `problem_attempts`, `explanation_events`,
  `concept_metrics`, `review_schedule`, `graph_layouts`.
- SM-2 scheduler computing `review_schedule` from `recall_events.score` (0–3).
- Projection job that derives `concept_metrics` (mastery, retention, recall/problem
  accuracy) from events. Idempotent; replayable from the event log.
- Seed dataset (one subject, e.g. Linear Algebra: Vectors · Matrix · Eigenvector · SVD).
**Exit:** seeding events and running projections yields correct metrics and schedules,
verified against hand-computed expectations.

## Phase 2 — Dashboard (Variation A)
First real page; proves the read path end to end.
- `DueReviews` hero, `WeakConcepts`, `RetentionTrends`; right rail `LearningHealth`,
  `KnowledgeHeatMap` mini grid, `SubjectProgress`.
- Reads only projection tables. Empty state teaches ("Create your first concept…").
**Exit:** dashboard reflects seeded data; "Begin Review" routes into Phase 4.

## Phase 3 — Concept Page (Variation A) — HIGHEST PRIORITY
The most important page. Visualizations never hidden behind tabs.
- `ConceptHeader` · `ConceptMetrics` bar · full-width `VisualizationPanel`
  (~40% viewport) · two-column content (Intuition/Definition/Notes |
  Recall/Problems/Dependencies/AI Insights).
- All math via KaTeX. `AIInsightsPanel` wired to the tutoring model.
**Exit:** a seeded concept renders all cards with live metrics and real visualization.

## Phase 4 — Review Interface (Variation A, with B's input state)
Full-screen, no sidebar. **The learner produces an answer; the AI assigns the score —
no self-grading.**
- Flow: `ProgressIndicator` → `Prompt` → active `AnswerArea` → `SubmitButton` →
  `AIAssessment` (auto score + rationale + next interval) → `Continue`.
- Score shown as a quiet read-only outcome bar, never as a choice. SM-2 interval written
  back to `review_schedule`; new `recall_events` emitted → triggers projection update.
- Fully keyboard-driven.
**Exit:** completing a review updates schedule and metrics, visible on the dashboard.

## Phase 5 — Knowledge Graph (Variation B)
Living atlas, not a dependency graph.
- React Flow canvas: circular nodes sized by importance, colored by heat; subtle edges
  emphasized on interaction; named clusters/regions.
- Floating (L3) inspector: selected concept, heat, prerequisites, "Show learning path".
- Behaviors: Zoom · Pan · Search · Highlight Dependencies · Highlight Weak Concepts ·
  Show Learning Paths. Layout persisted in `graph_layouts`, **decoupled** from
  `concept_relationships`.
- `prefers-reduced-motion`: graph settles instantly.
**Exit:** navigating, selecting, and pathfinding work; layout persists across reloads.

## Phase 6 — Polish & optional modes
- Concept **C** "focus mode" (full-bleed viz + floating glass) toggle.
- Graph **A** immersive (full-bleed + floating controls) toggle.
- Review **C** "tutor mode" tone.
- Accessibility pass: visible focus everywhere, reduced-motion audit, keyboard coverage.
- Performance: virtualize large lists/graphs; cache projections.
**Exit:** optional modes ship behind toggles; a11y and perf checks pass.

---

## Sequencing notes
- Phases 0–1 are strictly prerequisite. Phases 2–5 each depend on the prior data being
  present but are independently demoable.
- Concept Page (Phase 3) is highest product priority but is placed after Dashboard so the
  read path and shell are proven on a simpler surface first.
- The Review re-scope (AI-assigned score, no self-grading) is locked; do not reintroduce
  self-grading buttons in any phase.
