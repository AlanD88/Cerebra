# Cerebra Frontend Spec — Phase 4 · Review Interface v1.0

Companion to `roadmap.md` (Phase 4 — Review, Variation A + B's input state),
`data-architecture.md` (SM-2 + the events this writes), and `agent-rules.md`. Maps the
full-screen review surface to a concrete React + TypeScript implementation.

Visual companion: `Cerebra Review Frontend Spec.dc.html`.

**The locked invariant.** The learner produces an answer; **the AI assigns the score.**
There is **no self-grading** — never render score-selection buttons. The score is surfaced
as a quiet, read-only outcome (heat dot + label + one-line rationale + next interval), never
as a choice. The interface is **full-screen, no sidebar, fully keyboard-driven**.

This is the only phase whose core is a **client state machine**, so the spec leads with it.

---

## 1. Session state machine

A review session is an ordered queue of due items for one concept (or a mixed queue from the
dashboard). Each item walks a five-state machine; the score is **never** a learner input.

```
            ┌─────────────────────────────────────────────────────────┐
            ▼                                                         (next item)
   PROMPT ──► ANSWERING ──► SUBMITTING ──► ASSESSED ──► (Continue) ──┘
   show Q     learner       POST answer    AI score +        │
   read-only  types/edits   → AI assess    rationale +       └──► COMPLETE
              [Cmd+Enter]    (no grade UI)  next interval          (queue empty)
                                            shown read-only         → summary
```

| State | UI | Allowed transitions |
|---|---|---|
| `PROMPT` | ProgressIndicator + Prompt; AnswerArea focused, empty | → `ANSWERING` on first keystroke |
| `ANSWERING` | AnswerArea active; Submit enabled when non-empty | → `SUBMITTING` on Submit / `Cmd+Enter` |
| `SUBMITTING` | AnswerArea locks; "Assessing…" pulse | → `ASSESSED` on response; → `ANSWERING` on error |
| `ASSESSED` | Model answer revealed; **AIAssessment bar** (read-only outcome); Continue focused | → `PROMPT` (next) / `COMPLETE` (last) on Continue |
| `COMPLETE` | Session summary (items, score spread, intervals set) | → exit to origin (dashboard/concept) |

There is no state in which the learner can pick or change the score. `ASSESSED` is terminal
for the item — the SM-2 writeback (§4) happens server-side on the assess call, before this
state renders.

---

## 2. Component tree

Route `/review/:sessionId` — **renders outside `AppShell`** (full-screen, no sidebar).

```
ReviewSession                                  route "/review/:sessionId" · no shell
└─ ReviewChrome                                full-screen cream, max 660px column
   ├─ ProgressIndicator                        ← session queue (local)  "1 / 4" + bar
   ├─ PromptPanel                              ← current item.prompt (KaTeX)
   ├─ AnswerArea          state: ANSWERING     local: draft text · autofocus
   │  └─ SubmitButton                          enabled when draft non-empty · Cmd+Enter
   ├─ ModelAnswerPanel    state: ASSESSED      ← item.modelAnswer (KaTeX, revealed)
   └─ AIAssessmentBar     state: ASSESSED      ← assess response — READ-ONLY outcome
      ├─ OutcomeChip                           heat dot + label ("Mostly correct")
      ├─ RationaleText                         one-line "why", + how to reach Perfect
      ├─ NextIntervalLabel                     "next review · in 4 days"
      └─ ContinueButton                        autofocus · Enter → next item
```

`AIAssessmentBar` has **no interactive scoring control** — `OutcomeChip` is a static badge.
The only actionable element in `ASSESSED` is `ContinueButton`.

---

## 3. Data bindings

| Component | Source | Query / mutation | Returns |
|---|---|---|---|
| `ProgressIndicator` | session queue | `['review', sessionId]` | `{ items[], index, total, conceptName }` |
| `PromptPanel` | current item | (from queue) | `{ prompt }` |
| `ModelAnswerPanel` | assess response | (from mutation result) | `{ modelAnswer }` |
| `AIAssessmentBar` | assess response | **mutation** `assessAnswer` | `{ score, label, rationale, nextIntervalDays, heatState }` |

**The assess mutation is the heart of the page:**

```
POST /api/review/:sessionId/assess
  body: { itemId, learnerAnswer }
  server: AI scores 0–3 → append recall_event(score, rationale, assessed_by)
          → SM-2 updates review_schedule(interval, ease, due_at)
          → projection job updates concept_metrics
  returns: { score, label, rationale, nextIntervalDays, heatState, modelAnswer }
```

The client sends only the answer. Score, rationale, next interval, and model answer all come
**back** from the server — the client never computes or proposes a score.

---

## 4. Writeback & invalidation

On `assessAnswer` success (the `SUBMITTING → ASSESSED` transition):

1. Server has already appended the `recall_event` and run SM-2 → `review_schedule` +
   `concept_metrics` are current (event-derived, per `data-architecture.md`).
2. Client `onSuccess` invalidates: `['concept', conceptId]`, `['concept', conceptId,
   'recall']`, and the whole `['dashboard']` scope — so mastery, heat, due counts, and weak
   lists reflect the review the moment the learner returns.
3. **No optimistic update of metrics.** The projection is the source of truth; we render the
   server's returned outcome, not a guess. (The only optimistic move is advancing the local
   queue index on Continue.)

SM-2 mapping (0–3) is server-side and specified in `data-architecture.md` §4 — the frontend
never reimplements it.

---

## 5. State model

| | Where | Examples |
|---|---|---|
| **Server state** | TanStack Query | `['review', sessionId]` queue; `assessAnswer` mutation result |
| **Local session state** | `useReducer` in `ReviewSession` | `phase` (the §1 machine), `index`, `draft`, `lastOutcome` |
| **Derived** | render | Submit enabled (`draft.trim().length > 0`), progress %, isLastItem |

A `useReducer` (not scattered `useState`) owns the machine — transitions are explicit
actions (`START_TYPING`, `SUBMIT`, `ASSESSED`, `CONTINUE`, `ERROR`), which keeps the
"no path to self-grade" property auditable: there is simply no `SET_SCORE` action.

---

## 6. Keyboard model (fully keyboard-driven)

| Key | State | Action |
|---|---|---|
| (type) | `PROMPT`/`ANSWERING` | edit draft; AnswerArea autofocused on item load |
| `Cmd/Ctrl+Enter` | `ANSWERING` | submit answer |
| `Enter` | `ASSESSED` | Continue → next item (ContinueButton autofocused) |
| `Esc` | any | confirm-exit session |

Focus moves deliberately: AnswerArea on each new `PROMPT`, ContinueButton on each `ASSESSED`.
Every control has a visible focus ring (Phase 0 a11y rule). No mouse is ever required.

---

## 7. Loading / empty / error states

| Component | Loading | Empty / edge |
|---|---|---|
| `ReviewSession` | full-screen "Preparing your session…" | **empty queue** → "Nothing due right now — you're caught up." + exit |
| `AnswerArea` | n/a (instant) | Submit disabled while draft is empty |
| `AIAssessmentBar` | `SUBMITTING` → "Assessing your answer…" pulse | — |
| assess failure | — | inline retry on the bar; answer is **preserved**, phase returns to `ANSWERING`; never lose the learner's text |

**Motion** — model answer + assessment bar reveal with Fast (150ms) fade/slide; honor
`prefers-reduced-motion` (instant, no transform). No bounce. The bar must not cause layout
shift that moves the Continue button under the cursor mid-transition.

---

## 8. Phase 4 exit criteria

Completing a review writes a `recall_event`, runs SM-2 to update `review_schedule`, triggers
the projection, and — on return — the dashboard and concept page reflect the new mastery and
due dates. The score is always AI-assigned and shown read-only; there is no self-grading
control anywhere in the flow; the entire session is operable by keyboard alone.
