# Cerebra UI Wireframes v1.0

Companion spec to `Cerebra UI Wireframes.dc.html`. Structured low-fidelity layouts
for the four key pages, three variations each. Desktop, 1400px max content width.
Component names map to the Frontend Structure in the Technical Architecture doc.

**Global shell (all pages except Review)**
- Icon-only sidebar, 52px wide, Forest (`#30433D`) background, expands on hover to
  show text labels. Nav order: Dashboard · Subjects · Knowledge Graph · Reviews · Settings.
- Content canvas is Level 0 (Cream `#F5F1E8` paper). Max content width 1400px, centered.
- Surfaces follow the four-level system: Paper Card (L1), Glass Panel (L2), Floating (L3), Modal (L4).
- Heat encoding is consistent everywhere: Mastered `#30433D` · Hot `#61715A` ·
  Warm `#D9C8A9` · Cold `#B17457` · Frozen muted charcoal `#6b6f6c`.

---

## 01 · Dashboard

Purpose: answer *What do I know? · What am I forgetting? · What should I study next?*
Reads **only** from projection tables — never aggregates raw events live.
Visual hierarchy priority: Due Reviews → Weak Concepts → Current Learning Focus.

### Variation A — "Study Desk" (recommended)
Primary reading column + right rail.
- **Main column:** `DueReviews` hero card (Forest, large count + "Begin Review" CTA) →
  `WeakConcepts` list (heat-dotted rows) → `RetentionTrends` chart.
- **Right rail:** `LearningHealth` glass panel (avg mastery, streak) → `KnowledgeHeatMap`
  mini grid → `SubjectProgress` bars.
- Feels most like a study desk; clear single focal point.

### Variation B — "Command Grid"
Three stat tiles across the top (`DueReviews` / `LearningHealth` / `Streak`), then a
two-column row (`WeakConcepts` | `RetentionDistribution`), then a full-width
`KnowledgeHeatMap`. Hierarchy expressed through tile size. Densest of the three.

### Variation C — "Focus First"
Thin metrics strip at top, a large centered Today panel (`CurrentLearningFocus` +
`DueReviews` CTA), and a calm full-width heat band below. Most "sanctuary" feel; lowest
information density. Best if we want to fight dashboard-as-cockpit perception.

**Open decision:** A vs C is a density-vs-calm tradeoff. A is the safer default for a
power learner; C better serves the anti-gamified emotional goals.

---

## 02 · Concept Page — HIGHEST PRIORITY

The most important page in the system. Rule: **visualizations are never hidden behind
tabs** and must occupy significant screen space.
Components: `ConceptHeader` · `ConceptMetrics` · `IntuitionCard` · `DefinitionCard` ·
`NotesCard` · `VisualizationPanel` · `RecallQuestionsPanel` · `ProblemsPanel` ·
`DependenciesPanel` · `AIInsightsPanel`.
- `ConceptHeader`: concept name, subject, heat-state dot, mastery, next review.
- `ConceptMetrics` bar: Mastery · Retention · Recall accuracy · Problem accuracy.

### Variation A — Visualization-dominant
Header → Metrics bar → full-width `VisualizationPanel` (~40% viewport height) → two-column
content (Intuition/Definition/Notes left; Recall/Problems/Dependencies/AI Insights right).
Visualization is prominent but scrolls away — good for read-through study.

### Variation B — "Textbook" (recommended)
Full-width header + metrics, then a split body: **sticky** `VisualizationPanel` on the
left (~44%), scrolling content column on the right. Visualization stays visible while
reading any card — best honors "never hide the visualization" without sacrificing content.

### Variation C — Full-bleed viz + floating glass
`VisualizationPanel` fills the canvas; a compact glass header, a floating side glass panel
(Intuition + Dependencies), and a bottom content drawer overlay it. Most spatial / "Earthy
Glass" expression. Highest risk: glass legibility over a busy visualization, and content
discoverability in the drawer. Reserve for Phase 6 polish.

**Recommendation:** ship **B** as the canonical Concept Page; treat C as an aspirational
"focus mode" toggle.

---

## 03 · Review Interface

Purpose: focused recall, minimal distractions. No sidebar — full-screen review session.
**The learner produces an answer; the AI determines the score — there is no self-grading.**
The SM-2 / `recall_events.score` value (Forgot = 0 · Partial = 1 · Mostly Correct = 2 ·
Perfect = 3) is assigned by the assessment model, never picked by the user, so it is shown
as a quiet *outcome*, not a prominent set of buttons.
Layout: `ProgressIndicator` (top) → `Prompt` → `AnswerArea` (active text input) →
`SubmitButton` → `AIAssessment` (auto score + rationale + next interval) → `Continue`.

### Variation A — Recall → AI grades it (recommended)
Single reading column: prompt, the learner's typed recall, and the model answer, with a
quiet read-only verdict bar pinned at the bottom — heat dot + label ("Mostly correct"),
one-line rationale, next interval, and a single `Continue`. The score is presented as a
result of assessment, never a choice. Honors the "AI determines the score" rule most
directly while keeping the screen calm.

### Variation B — Active recall input
The pre-grade moment: prompt centered above a focused answer field with a `Check my answer`
submit. Emphasizes that the learner's job is to *produce* the answer; "the AI scores it for
you" is stated as a quiet hint. Pairs with A as the two halves of one flow.

### Variation C — Conversational
A calm chat thread: prompt → the learner's recall → a single quiet AI reply carrying a
small heat chip, a short rationale, and the auto-scheduled interval. Most forgiving and
least cockpit-like; good if we want review to feel like a tutor rather than a test.

**Recommendation:** ship **A** (with B's input as its first state) as the canonical Review;
treat C as an optional "tutor mode" tone.

---

## 04 · Knowledge Graph

Goal: a living atlas of understanding — not a developer dependency graph. Nodes are
circular, sized by importance, colored by heat state. Edges subtle, emphasized on
interaction. Concept clusters form named regions (Vectors, Matrix, Eigenvector, SVD).
Behaviors: Zoom · Pan · Search · Highlight Dependencies · Highlight Weak Concepts ·
Show Learning Paths. Built on React Flow; layout persisted in `graph_layouts` (decoupled
from knowledge relationships).

### Variation A — Full-bleed + floating controls
Canvas fills the frame. Floating search (top-left), filter chips (top-right), zoom
(bottom-left). Most immersive / atlas-like; controls stay out of the way.

### Variation B — Canvas + inspector panel (recommended)
Canvas with a Floating-surface (L3) inspector on the right showing the selected concept:
name, heat, prerequisites list, "Show learning path" action. Best balance of exploration
and actionable detail; the inspector is where dependency insights surface.

### Variation C — Toolbar + status bar
Top toolbar (search, filters, auto-layout), canvas, bottom status bar (node/edge counts,
active region, zoom). Most utilitarian; risks feeling like a dev tool — against the design
intent — but most discoverable for power features.

**Recommendation:** **B** — immersive canvas (A's instinct) plus the inspector, which is
where weakness-propagation and learning-path features become useful.

---

## Cross-cutting notes
- **Motion:** node repositioning and panel transitions use Normal (250ms); reveal/hover use
  Fast (150ms). No bounce/elastic.
- **Accessibility:** every interactive control needs a visible focus state; Review must be
  fully keyboard-driven; honor `prefers-reduced-motion` (graph settles instantly).
- **Math:** all notation in `VisualizationPanel`, prompts, and definitions renders via
  KaTeX — never images of equations.
- **Empty states:** each page teaches rather than shows a generic placeholder (e.g. an empty
  graph: "Create your first concept to begin building your knowledge graph.").

## Selected set (decisions)
Dashboard **A** · Concept Page **A** · Review **A** (recall → AI grades) · Graph **B**.
The Review direction was re-scoped: the original self-grading buttons are dropped because
the AI determines the score; the assessment now surfaces as a quiet outcome. Concept **C**
and Graph **A** instincts remain available as optional focus/immersive modes in Phase 6.
