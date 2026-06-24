# Cerebra MCP bridge

A stdio [MCP](https://modelcontextprotocol.io) server that lets a Claude session
push study outcomes into Cerebra and query its derived state (due / weak /
mastery) over HTTP. It is the bridge behind the **deep-learn** study skill: the
vault's `knowledge_log.md` stays the source of truth for the study loop, and
Cerebra becomes a **passive mirror** — a durable analytics + knowledge-graph
layer that derives its *own* SM-2 schedule and mastery from the events you push.

Nothing is ever written back into the vault. The two schedulers differ on purpose
(deep-learn = fixed interval ladder; Cerebra = SM-2 + mastery blend); we push
*events*, Cerebra derives its own metrics, and we never try to make the two
schedules agree.

## What it talks to

The server calls Cerebra's FastAPI ingest surface (`/api/v1/ingest/*`) and a few
projection-backed reads. **Cerebra must be running** during a sync (`./dev.sh` in
the repo root). If the API is unreachable, every tool returns a clear message
instead of erroring, so a session degrades gracefully to vault-only.

## Tools

| Tool | Purpose |
|---|---|
| `cerebra_sync_session(subject, topics[], events[])` | **Primary push.** Batch-upsert a subject + its topics (and prerequisite edges) and append every event of a study session, projecting each touched concept once. Call once per session. |
| `cerebra_log_recall(subject, topic, prompt, grade, …)` | Log a single recall (`grade` = full/partial/forgotten → 3/1/0). |
| `cerebra_log_problem(subject, topic, prompt, is_correct, …)` | Log a practice-problem attempt. |
| `cerebra_log_explanation(subject, topic, content, quality?)` | Log a Feynman/teach-back explanation. |
| `cerebra_upsert_subject(name, description?)` | Create/update a subject (returns its UUID). |
| `cerebra_upsert_concept(subject, name, …)` | Create/update a topic. |
| `cerebra_add_relationship(subject, prerequisite, dependent, type?)` | Add a graph edge. |
| `cerebra_due_reviews()` | Concepts Cerebra thinks are due now. |
| `cerebra_weak_concepts(limit=10)` | Lowest-mastery engaged concepts. |
| `cerebra_subjects()` / `cerebra_subject_progress()` | Subject list / progress rollup. |
| `cerebra_concept_status(subject, topic)` | Cerebra's mastery/heat view of one topic. |

The grade → score mapping is `full → 3`, `partial → 1`, `forgotten → 0`.

## Install

Reuse the API's virtualenv (created by `./dev.sh`):

```bash
api/.venv/bin/pip install -r mcp/requirements.txt
```

`CEREBRA_API_URL` defaults to `http://localhost:8000/api/v1`.

## Register

**User scope** (available from any Claude Code session). Use absolute paths:

```bash
claude mcp add -s user cerebra -- \
  /ABS/PATH/cerebra/api/.venv/bin/python /ABS/PATH/cerebra/mcp/cerebra_mcp.py
```

**Project scope for the vault** — drop a `.mcp.json` at the vault root
(`~/github/LearningMD/.mcp.json`) so deep-learn sessions auto-discover it. A
ready-to-edit copy is in [`examples/vault.mcp.json`](./examples/vault.mcp.json):

```json
{
  "mcpServers": {
    "cerebra": {
      "command": "/ABS/PATH/cerebra/api/.venv/bin/python",
      "args": ["/ABS/PATH/cerebra/mcp/cerebra_mcp.py"],
      "env": { "CEREBRA_API_URL": "http://localhost:8000/api/v1" }
    }
  }
}
```

## Wire it into deep-learn

See [`deep-learn-integration.md`](./deep-learn-integration.md) for the exact,
additive edits to the deep-learn `SKILL.md` (Session Close sync, Session Open
cross-check, the mapping table, and Initialization). They live outside this repo,
so they are documented here for you to apply locally.

## Smoke test

```bash
./dev.sh                                  # start the API (:8000) + web (:5173)
CEREBRA_API_URL=http://localhost:8000/api/v1 \
  api/.venv/bin/python - <<'PY'
import mcp.cerebra_mcp as m            # or run from the mcp/ dir
print(m.cerebra_log_recall("Linear Algebra", "Eigenvectors",
      "Define an eigenvector", "full", "a direction only scaled by A"))
print(m.cerebra_due_reviews())
PY
```

Stop the API and re-run to confirm the graceful "not reachable" message.
