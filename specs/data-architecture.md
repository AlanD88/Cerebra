# Cerebra Data Architecture — Phase 1 Spec v1.0

Companion to `roadmap.md` (Phase 1 — Data spine) and `agent-rules.md`. Defines the
PostgreSQL schema at column level, the event → projection pipeline that derives all
metrics, and the SM-2 scheduler. This is the canonical reference for the backend build.

**Core principle.** Mastery is *event-derived*. Learner actions append immutable events;
a projection job derives `concept_metrics` and `review_schedule` from those events. The UI
reads **only** the projection tables — it never aggregates raw events live. Projections are
idempotent and replayable: deleting and rebuilding them from the event log yields identical
results.

Visual companion: `Cerebra Data Architecture.dc.html`.

---

## 1. Entity overview

Nine entities in four functional groups.

| Group | Tables | Nature |
|---|---|---|
| **Core (graph model)** | `subjects`, `concepts`, `concept_relationships` | Authored / structural |
| **Events (log)** | `recall_events`, `problem_attempts`, `explanation_events` | Append-only, immutable |
| **Projections** | `concept_metrics`, `review_schedule` | Derived; UI reads only these |
| **Layout** | `graph_layouts` | Presentation; decoupled from relationships |

Cardinality:
- `subjects` 1 — ∞ `concepts`
- `concepts` ∞ — ∞ `concepts` **via** `concept_relationships` (directed: source = prerequisite, target = dependent)
- `concepts` 1 — ∞ each of `recall_events`, `problem_attempts`, `explanation_events`
- `concepts` 1 — 1 `concept_metrics`
- `concepts` 1 — 1 `review_schedule`
- `concepts` 1 — 1 `graph_layouts` (per `layout_version`)

---

## 2. Schema — column level

Types are PostgreSQL. All `id` columns are `uuid` (default `gen_random_uuid()`). All
timestamps are `timestamptz`. PK = primary key, FK = foreign key, UQ = unique constraint.

### 2.1 Core group

**`subjects`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | not null |
| `description` | text | nullable |
| `accent` | text | nullable — hex override of group color |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

**`concepts`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → `subjects.id`, on delete cascade |
| `name` | text | not null |
| `slug` | text | UQ (per `subject_id`) |
| `importance` | smallint | 1–5; drives graph node size |
| `intuition` | text | nullable |
| `definition` | text | KaTeX source |
| `notes` | text | nullable |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

**`concept_relationships`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → `subjects.id` (denormalized for scoping) |
| `source_concept_id` | uuid | FK → `concepts.id` — prerequisite |
| `target_concept_id` | uuid | FK → `concepts.id` — dependent |
| `type` | enum | `prerequisite` · `related` · `extends` |
| `strength` | real | 0–1, edge weight; nullable |
| `created_at` | timestamptz | default now() |
| — | — | UQ (`source_concept_id`, `target_concept_id`, `type`) |

### 2.2 Events group — append-only, immutable

No `updated_at`; events are never mutated, only superseded by newer events. Each carries
`occurred_at` (logical event time, may differ from insertion time).

**`recall_events`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `concept_id` | uuid | FK → `concepts.id` |
| `prompt` | text | the question shown |
| `learner_answer` | text | what the learner produced |
| `model_answer` | text | reference answer |
| `score` | smallint | **0–3, assigned by the AI** (Forgot/Partial/Mostly/Perfect) |
| `rationale` | text | one-line assessment reason |
| `assessed_by` | text | model id / version |
| `occurred_at` | timestamptz | not null |

**`problem_attempts`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `concept_id` | uuid | FK → `concepts.id` |
| `prompt` | text | problem statement |
| `learner_answer` | text | submitted solution |
| `is_correct` | boolean | terminal correctness |
| `partial` | real | 0–1 partial credit; nullable |
| `occurred_at` | timestamptz | not null |

**`explanation_events`**

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `concept_id` | uuid | FK → `concepts.id` |
| `content` | text | the explanation text |
| `direction` | enum | `learner_to_ai` (Feynman) · `ai_to_learner` |
| `quality` | smallint | 0–3; nullable (only scored for learner_to_ai) |
| `occurred_at` | timestamptz | not null |

### 2.3 Projections group — derived, UI reads only these

One row per concept (PK = `concept_id`). Rewritten by the projection job; never edited by
hand. `projection_version` lets a metrics row be invalidated and rebuilt.

**`concept_metrics`**

| Column | Type | Key / Notes |
|---|---|---|
| `concept_id` | uuid | PK, FK → `concepts.id` |
| `mastery` | real | 0–1, composite |
| `retention` | real | 0–1, forgetting-curve estimate |
| `recall_accuracy` | real | 0–1, recency-weighted |
| `problem_accuracy` | real | 0–1, recency-weighted |
| `heat_state` | enum | `mastered` · `hot` · `warm` · `cold` · `frozen` |
| `stability` | real | SM-2 memory strength (days) |
| `review_count` | int | total recall events |
| `last_reviewed_at` | timestamptz | nullable |
| `projection_version` | int | bumped on logic change to force rebuild |
| `updated_at` | timestamptz | when last projected |

**`review_schedule`**

| Column | Type | Key / Notes |
|---|---|---|
| `concept_id` | uuid | PK, FK → `concepts.id` |
| `due_at` | timestamptz | when the concept is next due |
| `interval_days` | real | current SM-2 interval |
| `ease_factor` | real | SM-2 EF, default 2.5 |
| `repetitions` | int | consecutive successful reviews |
| `last_score` | smallint | 0–3, last recall score |
| `last_reviewed_at` | timestamptz | nullable |
| `updated_at` | timestamptz | when last scheduled |

### 2.4 Layout group

**`graph_layouts`** — node positions, **decoupled** from `concept_relationships`. Moving a
node never changes a relationship; editing a relationship never moves a node.

| Column | Type | Key / Notes |
|---|---|---|
| `id` | uuid | PK |
| `subject_id` | uuid | FK → `subjects.id` |
| `concept_id` | uuid | FK → `concepts.id` |
| `x` | real | canvas x |
| `y` | real | canvas y |
| `pinned` | boolean | user-pinned vs auto-layout |
| `layout_version` | int | supports multiple saved layouts |
| `updated_at` | timestamptz | default now() |
| — | — | UQ (`concept_id`, `layout_version`) |

---

## 3. Event → projection pipeline

Four stages. The write path (1) and read path (4) are separated by the projection (2–3) —
this is the event-sourcing seam that keeps the UI off the raw event log.

### Stage 1 · Capture (write path)
A learner action produces an **immutable event**:
- Review: learner submits an answer → the AI assessment model assigns `score` ∈ {0,1,2,3}
  → append a `recall_event`. (The learner never picks the score — see `agent-rules.md`.)
- Problem solving → append a `problem_attempt`.
- Feynman explanation → append an `explanation_event`.

### Stage 2 · Derive (projection)
A projection runs for each affected `concept_id`. It reads a recency-windowed slice of that
concept's events and computes, with recency weight `wᵢ = exp(−λ · ageᵢ)`:

```
recall_accuracy  = Σ wᵢ·(scoreᵢ / 3)        / Σ wᵢ      over recall_events
problem_accuracy = Σ wᵢ·(is_correctᵢ ? 1 : partialᵢ) / Σ wᵢ   over problem_attempts
stability        = SM-2 memory strength, updated from the latest recall score
retention        = exp(−Δt / stability)      where Δt = now − last_reviewed_at
mastery          = 0.45·recall_accuracy + 0.25·problem_accuracy + 0.30·retention
                   (+ small capped bonus from explanation_events.quality)
heat_state       = threshold(mastery, retention, Δt)   — see §5
```

### Stage 3 · Schedule (SM-2)
From the latest recall `score`, update `ease_factor`, `repetitions`, `interval_days`, and
`due_at`; write `review_schedule`. See §4.

### Stage 4 · Serve (read path)
The UI reads `concept_metrics` and `review_schedule` only. Dashboard, Concept Page, and
Graph never aggregate `recall_events` / `problem_attempts` live.

**Pipeline properties**
- **Idempotent** — same events ⇒ same projection output.
- **Replayable** — drop projections, replay the log, get identical state.
- **Versioned** — `projection_version` invalidates and rebuilds rows when logic changes.
- **Never live-aggregated** — enforced by convention and code review; the read path has no
  access to raw event aggregation in query layers.

---

## 4. SM-2 scheduler (0–3 adaptation)

Classic SM-2 uses a 0–5 quality scale; Cerebra uses the AI's 0–3 score. Map and adapt:

```
q = score            # 0 Forgot · 1 Partial · 2 Mostly Correct · 3 Perfect

if q <= 1:                       # failed recall
    repetitions   = 0
    interval_days = 1
else:
    repetitions  += 1
    interval_days = 1                       if repetitions == 1
                    6                       if repetitions == 2
                    round(prev_interval · ease_factor)   otherwise

# ease update (3 = best here, vs 5 in classic SM-2)
ease_factor += 0.1 − (3 − q) · (0.08 + (3 − q) · 0.02)
ease_factor  = max(ease_factor, 1.3)

due_at    = last_reviewed_at + interval_days
stability = interval_days · ease_factor     # feeds retention in §3
```

`ease_factor` default is 2.5. A perfect score (q=3) nudges EF up by 0.1; a partial (q=1)
drops it sharply and resets the interval.

---

## 5. Heat-state derivation

`heat_state` is a function of `mastery`, `retention`, and recency `Δt`. Thresholds (tune in
Phase 6); colors are the global heat encoding from `agent-rules.md`.

| State | Condition | Color |
|---|---|---|
| **Mastered** | mastery ≥ 0.85 and retention ≥ 0.80 | Forest `#30433D` |
| **Hot** | 0.70 ≤ mastery < 0.85, recently reviewed | Moss `#61715A` |
| **Warm** | 0.40 ≤ mastery < 0.70 | Sand `#D9C8A9` |
| **Cold** | mastery < 0.40 or retention < 0.50 | Clay `#B17457` |
| **Frozen** | never reviewed, or Δt very large (dormant) | Muted charcoal `#6b6f6c` |

---

## 6. Phase 1 exit criteria

From `roadmap.md`: seeding events (one subject — e.g. Linear Algebra: Vectors · Matrix ·
Eigenvector · SVD) and running projections yields correct `concept_metrics` and
`review_schedule`, verified against hand-computed expectations. Projections must rebuild
identically from the event log alone.
