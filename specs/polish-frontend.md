# Cerebra Frontend Spec — Phase 6 · Polish & Optional Modes v1.0

Companion to `roadmap.md` (Phase 6 — Polish & optional modes) and `agent-rules.md`. The
final phase: optional alternate treatments behind toggles, plus the accessibility and
performance passes that make the product shippable. Nothing here changes the data model or
the locked invariants — it refines surfaces that already work.

Visual companion: `Cerebra Polish Frontend Spec.dc.html`.

**Guiding principle.** Optional modes ship **behind toggles, defaulting off.** The canonical
direction (Dashboard A · Concept A · Review A · Graph B) remains the default experience; a
mode is a per-user preference, never a fork of the codebase.

---

## 1. Optional modes

Each is an alternate treatment of an existing surface — same data, same components, a
`mode` prop that swaps layout/tone. Stored as a user preference (`localStorage` +
`user_preferences` row), read at the surface root.

| Mode | Surface | Default | What changes | What does NOT change |
|---|---|---|---|---|
| **Concept C — Focus** | Concept Page | off | Full-bleed visualization; body cards collapse into a floating L3 glass drawer | Data bindings, KaTeX, the never-tab-gated rule (viz is *more* prominent, not hidden) |
| **Graph A — Immersive** | Knowledge Graph | off | Canvas goes full-bleed; controls float as L3 over the graph; sidebar auto-collapses | Decoupling of layout vs relationships; all six behaviors |
| **Review C — Tutor tone** | Review Interface | off | Warmer rationale copy, encouraging microcopy, softer transitions | AI-assigned score, no self-grading, keyboard model |

A mode is a **presentational variant**, enforced by a rule: a mode toggle may change layout,
copy tone, and chrome placement — it may **never** change a data binding, a write path, or a
locked invariant. Modes are mutually independent (per surface) and composable across surfaces.

---

## 2. Mode plumbing

```
useMode(surface)  →  reads user_preferences.modes[surface]  (localStorage-cached)
                     returns { mode, setMode }
```

- Read at each surface root (`ConceptPage`, `GraphPage`, `ReviewSession`), passed down as a
  `mode` prop. Leaf components branch on `mode` for layout/tone only.
- `setMode` writes through to `PATCH /api/preferences` and updates the local cache
  optimistically (a preference is safe to be optimistic about — it's not a metric).
- SSR/first-paint: default mode renders immediately; a stored non-default mode applies on
  hydration without a layout-shift flash (mode class set on the surface root before paint).

---

## 3. Accessibility pass (applies to ALL surfaces)

| Area | Requirement |
|---|---|
| **Focus** | Visible focus ring on every interactive control (Phase 0 token). No `outline:none` without a replacement. |
| **Keyboard** | Review fully operable (Phase 4). Graph nodes Tab-focusable, inspector a focus trap (Phase 5). All dialogs/drawers trap + restore focus. |
| **Reduced motion** | `prefers-reduced-motion` honored everywhere: graph settles instantly, card reveals are instant, no bounce — audited per surface, not assumed. |
| **Contrast** | Verify the Earthy Glass palette meets WCAG AA for text — esp. Sage/Sand on Cream, and mono labels. Adjust token *usage* (not the palette) where it fails. |
| **Semantics** | Landmark roles (nav, main, dialog); metric cards have accessible labels; heat conveyed by label + dot, never color alone. |
| **Math** | KaTeX output has `aria-label` from the source TeX so screen readers don't read raw markup. |

**Heat is never color-alone** — every heat indicator pairs the dot with its text label
(`Mastered`, `Warm`, …), satisfying colorblind users and the `agent-rules.md` heat rule.

---

## 4. Performance pass

| Area | Requirement |
|---|---|
| **Lists** | Virtualize long lists (weak concepts, recall queues, dependency lists past ~50 rows). |
| **Graph** | `onlyRenderVisibleElements`, memoized nodes/edges (Phase 5). Target 60fps pan/zoom at 200+ nodes. |
| **Projections** | Read-path queries cache per Phase 2 defaults; never aggregate events on read. |
| **Code-split** | Lazy-load the Graph (React Flow) and KaTeX bundles per route; the Dashboard shouldn't pay for them. |
| **Images/fonts** | Preload the three font families (Phase 0); subset if needed; no layout shift on font swap. |
| **Query hygiene** | One core query per surface + satellites; no waterfalls; `keepPreviousData` to avoid refetch flashes. |

---

## 5. Cross-surface QA checklist

The exit gate for the whole product, not just this phase:

- [ ] Every page renders from **projection tables only** — no live event aggregation anywhere.
- [ ] Review **never** shows a score-selection control; score is always AI-assigned, read-only.
- [ ] Concept Page visualization is **never** tab-gated, in either default or focus mode.
- [ ] Graph layout persists to `graph_layouts` and survives reload **without** altering any
      relationship; vice versa.
- [ ] `prefers-reduced-motion` audited on all four surfaces — graph settles instantly.
- [ ] Visible focus on every control; Review + Graph fully keyboard-operable.
- [ ] Heat is shown by label + dot everywhere (never color alone); palette passes AA.
- [ ] Optional modes default off, persist per user, and change only presentation.
- [ ] Empty states teach on every surface; per-card errors never blank a page.

---

## 6. Phase 6 exit criteria

The three optional modes ship behind toggles (default off, persisted per user, presentation
only); the accessibility audit passes on all four surfaces (focus, keyboard, reduced-motion,
contrast, semantics, math labels); the performance pass meets the targets above; and the
cross-surface QA checklist is fully green. At that point Cerebra is shippable end to end.
