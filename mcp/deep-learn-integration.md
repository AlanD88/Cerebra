# Wiring the deep-learn skill to Cerebra

These edits live **outside this repo** (in `~/.claude/skills/deep-learn/SKILL.md`
and your vault), so they can't be committed here — apply them locally. Every edit
is **additive and guarded**: if Cerebra isn't configured for a project, the steps
are skipped silently and non-Cerebra projects are unaffected.

**Prerequisite check (use everywhere below):** the steps run only when the project
`CLAUDE.md` has a `## Cerebra` block *and* the `cerebra` MCP tools are available.
If a `cerebra_*` call returns a "not reachable" message, note it and continue —
the vault is authoritative; Cerebra is a passive mirror.

## The mapping (deep-learn → Cerebra)

| deep-learn | Cerebra | Rule |
|---|---|---|
| Project (`Learning/[Project]/`) | Subject | upsert by name |
| Topic (knowledge_log row) | Concept | slug = dash-cased topic |
| Recall prompt (verbatim) | recall `prompt` | — |
| **Full / Partial / Forgotten** | recall score **3 / 1 / 0** | Partial→1 (SM-2 lapse) |
| `[PRACTICE]` result | ProblemAttempt | `isCorrect` + `partial` 0–1 |
| 3-sentence rule / teach-back | ExplanationEvent | `quality` 0–3 |
| Conceptual-profile "Dependencies" | ConceptRelationship | prereq → dependent |
| Tier / Next Review | — | **not pushed** — Cerebra derives its own |

## 1. Initialization (Step 4) — create the subject

When a new learning project is initialized, create the Cerebra subject and record
it as the sync anchor:

```
cerebra_upsert_subject(name="<Project Name>")
```

Add a `## Cerebra` block to the project `CLAUDE.md` (this is what later steps key
off of):

```markdown
## Cerebra
Subject: <Project Name>
Subject ID: <uuid returned above>
```

## 2. Session Close → new Step 4b "Sync to Cerebra"

Immediately **after** the existing Task Manager (Plane) sync, push the whole
session in one call. Build it from the session's topics and events; map
Full/Partial/Forgotten → full/partial/forgotten (the server maps to 3/1/0):

```
cerebra_sync_session(
  subject = "<Project Name>",
  topics  = [ {name, intuition?, definition?, notes?, importance?, prerequisites?[]}, ... ],
  events  = [
    {type: "recall",      concept: "<Topic>", prompt: "<verbatim prompt>", grade: "full|partial|forgotten"},
    {type: "problem",     concept: "<Topic>", prompt: "<problem>", isCorrect: true|false, partial?: 0..1},
    {type: "explanation", concept: "<Topic>", content: "<teach-back>", quality?: 0..3}
  ]
)
```

**Call this exactly once per session.** Events are append-only; re-running would
duplicate them. **Passive-mirror rule:** do not copy Cerebra's returned dates or
mastery back into `knowledge_log.md` — the vault's schedule stays authoritative.

## 3. Session Open → optional Cerebra cross-check (Queue step)

As a *secondary* signal only, you may call `cerebra_due_reviews()` and
`cerebra_weak_concepts()` while assembling the queue, to surface anything Cerebra
flags as weak/overdue. `knowledge_log.md` remains the authority for what to review.

## 4. New "Cerebra Sync" subsection (near the Retention Engine)

Add a short subsection that states: the mapping table above, the passive-mirror
rule, the once-per-session constraint, and the prerequisite (Cerebra API running
+ `cerebra` MCP configured; if not, skip silently).
