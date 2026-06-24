"""Cerebra MCP server — the bridge between a Claude session (e.g. the deep-learn
study skill) and the Cerebra learning OS.

It exposes a handful of tools that push study outcomes into Cerebra's ingest API
and query its derived state (due / weak / mastery), talking to the FastAPI backend
over HTTP. Cerebra owns the math: we push *events*; Cerebra derives its own SM-2
schedule + mastery. Nothing here writes back into the caller's notes — Cerebra is
a passive analytics + knowledge-graph mirror.

Run (stdio):
    CEREBRA_API_URL=http://localhost:8000/api/v1 python cerebra_mcp.py

Requires the Cerebra API to be running (./dev.sh). If it isn't reachable, every
tool returns a clear message instead of raising, so a session degrades gracefully
to working without Cerebra.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("CEREBRA_API_URL", "http://localhost:8000/api/v1").rstrip("/")
TIMEOUT = float(os.environ.get("CEREBRA_TIMEOUT", "15"))

mcp = FastMCP("cerebra")


class _Unreachable(Exception):
    """Cerebra isn't up — surfaced to the model as a friendly, non-fatal string."""


def _request(method: str, path: str, json: dict | None = None) -> Any:
    url = f"{API_URL}{path}"
    try:
        resp = httpx.request(method, url, json=json, timeout=TIMEOUT)
    except httpx.RequestError as exc:
        raise _Unreachable(
            f"Cerebra API not reachable at {API_URL} — start it with ./dev.sh ({exc})"
        ) from exc
    if resp.status_code >= 400:
        # Surface validation/4xx errors verbatim so the model can correct the call.
        raise _Unreachable(f"Cerebra API error {resp.status_code} on {method} {path}: {resp.text}")
    if resp.content:
        return resp.json()
    return None


def _pct(x: float | None) -> str:
    return f"{round((x or 0.0) * 100)}%"


def _due_phrase(outcome: dict) -> str:
    days = outcome.get("nextIntervalDays")
    if days is None:
        return "no schedule yet"
    return f"next due in {round(days)}d"


def _outcome_line(o: dict) -> str:
    return (
        f"{o['name']} → mastery {_pct(o.get('mastery'))}, "
        f"{o.get('heatState', 'frozen')}, {_due_phrase(o)}"
    )


# --------------------------------------------------------------------------- #
# Query tools (reads — projection-backed)
# --------------------------------------------------------------------------- #
@mcp.tool()
def cerebra_due_reviews() -> str:
    """List the concepts Cerebra considers due for review now (its own SM-2
    schedule). A secondary signal — the vault's knowledge_log.md stays authoritative."""
    try:
        rows = _request("GET", "/review/due")
    except _Unreachable as exc:
        return str(exc)
    if not rows:
        return "Cerebra: nothing due right now."
    lines = [f"- {r['name']} ({r['subject']}) — mastery {_pct(r.get('mastery'))}, {r.get('heatState')}" for r in rows]
    return "Cerebra due now:\n" + "\n".join(lines)


@mcp.tool()
def cerebra_weak_concepts(limit: int = 10) -> str:
    """The lowest-mastery concepts the learner has actually engaged."""
    try:
        rows = _request("GET", f"/concepts/weak?limit={limit}")
    except _Unreachable as exc:
        return str(exc)
    if not rows:
        return "Cerebra: no weak concepts tracked yet."
    lines = [f"- {r['name']} ({r['subject']}) — mastery {_pct(r.get('mastery'))}, {r.get('heatState')}" for r in rows]
    return "Cerebra weakest concepts:\n" + "\n".join(lines)


@mcp.tool()
def cerebra_subjects() -> str:
    """List the subjects Cerebra knows about."""
    try:
        rows = _request("GET", "/subjects")
    except _Unreachable as exc:
        return str(exc)
    if not rows:
        return "Cerebra: no subjects yet."
    return "Cerebra subjects:\n" + "\n".join(f"- {r['name']}" for r in rows)


@mcp.tool()
def cerebra_subject_progress() -> str:
    """Per-subject progress rollup (average mastery + concept counts)."""
    try:
        rows = _request("GET", "/subjects/progress")
    except _Unreachable as exc:
        return str(exc)
    if not rows:
        return "Cerebra: no subject progress yet."
    out = []
    for r in rows:
        avg = r.get("avgMastery", r.get("mastery"))
        out.append(f"- {r['name']} — avg mastery {_pct(avg)}")
    return "Cerebra subject progress:\n" + "\n".join(out)


@mcp.tool()
def cerebra_concept_status(subject: str, topic: str) -> str:
    """Cerebra's current view of one topic: mastery, heat, and whether it's due.
    Resolves the topic by name within the subject via the due/weak reads."""
    try:
        due = _request("GET", "/review/due")
        weak = _request("GET", "/concepts/weak?limit=50")
    except _Unreachable as exc:
        return str(exc)
    for r in (due or []):
        if r["subject"] == subject and r["name"].lower() == topic.lower():
            return f"Cerebra: {r['name']} — mastery {_pct(r.get('mastery'))}, {r.get('heatState')}, due now."
    for r in (weak or []):
        if r["subject"] == subject and r["name"].lower() == topic.lower():
            return f"Cerebra: {r['name']} — mastery {_pct(r.get('mastery'))}, {r.get('heatState')}, not due."
    return f"Cerebra: no tracked status for {topic!r} in {subject!r} (not yet reviewed?)."


# --------------------------------------------------------------------------- #
# Push tools (writes — each flows through the projection pipeline)
# --------------------------------------------------------------------------- #
@mcp.tool()
def cerebra_upsert_subject(name: str, description: str | None = None) -> str:
    """Create (or update) a subject. Idempotent by name. Returns its UUID — record
    it in the project's CLAUDE.md as the sync anchor."""
    try:
        r = _request("POST", "/ingest/subjects", {"name": name, "description": description})
    except _Unreachable as exc:
        return str(exc)
    verb = "created" if r["created"] else "exists"
    return f"Cerebra subject {verb}: {r['name']} (id {r['id']})"


@mcp.tool()
def cerebra_upsert_concept(
    subject: str,
    name: str,
    importance: int = 3,
    intuition: str | None = None,
    definition: str | None = None,
    notes: str | None = None,
) -> str:
    """Create (or update) a topic/concept under a subject. Idempotent by slug."""
    body = {
        "subject": subject, "name": name, "importance": importance,
        "intuition": intuition, "definition": definition, "notes": notes,
    }
    try:
        r = _request("POST", "/ingest/concepts", body)
    except _Unreachable as exc:
        return str(exc)
    verb = "created" if r["created"] else "updated"
    return f"Cerebra concept {verb}: {r['name']} (slug {r['slug']})"


@mcp.tool()
def cerebra_log_recall(
    subject: str,
    topic: str,
    prompt: str,
    grade: str,
    learner_answer: str | None = None,
    occurred_at: str | None = None,
) -> str:
    """Log a recall outcome. grade is full | partial | forgotten (→ score 3/1/0).
    Auto-creates the subject/topic if missing. occurred_at is ISO-8601, optional."""
    body = {
        "subject": subject, "concept": topic, "prompt": prompt, "grade": grade,
        "learnerAnswer": learner_answer, "occurredAt": occurred_at, "createIfMissing": True,
    }
    try:
        r = _request("POST", "/ingest/recall", body)
    except _Unreachable as exc:
        return str(exc)
    return "Cerebra: " + _outcome_line(r)


@mcp.tool()
def cerebra_log_problem(
    subject: str,
    topic: str,
    prompt: str,
    is_correct: bool,
    partial: float | None = None,
    occurred_at: str | None = None,
) -> str:
    """Log a practice-problem attempt. partial is 0–1 credit when not fully correct."""
    body = {
        "subject": subject, "concept": topic, "prompt": prompt,
        "isCorrect": is_correct, "partial": partial,
        "occurredAt": occurred_at, "createIfMissing": True,
    }
    try:
        r = _request("POST", "/ingest/problem", body)
    except _Unreachable as exc:
        return str(exc)
    return "Cerebra: " + _outcome_line(r)


@mcp.tool()
def cerebra_log_explanation(
    subject: str,
    topic: str,
    content: str,
    quality: int | None = None,
    occurred_at: str | None = None,
) -> str:
    """Log a Feynman/teach-back explanation (learner → AI). quality is 0–3 and
    feeds Cerebra's mastery bonus."""
    body = {
        "subject": subject, "concept": topic, "content": content,
        "quality": quality, "occurredAt": occurred_at, "createIfMissing": True,
    }
    try:
        r = _request("POST", "/ingest/explanation", body)
    except _Unreachable as exc:
        return str(exc)
    return "Cerebra: " + _outcome_line(r)


@mcp.tool()
def cerebra_add_relationship(
    subject: str,
    prerequisite: str,
    dependent: str,
    type: str = "prerequisite",
) -> str:
    """Record a directed edge (prerequisite → dependent) in Cerebra's knowledge
    graph. Both topics must already exist in the subject."""
    body = {"subject": subject, "source": prerequisite, "target": dependent, "type": type}
    try:
        r = _request("POST", "/ingest/relationships", body)
    except _Unreachable as exc:
        return str(exc)
    verb = "added" if r["created"] else "exists"
    return f"Cerebra edge {verb}: {prerequisite} →{type}→ {dependent}"


@mcp.tool()
def cerebra_sync_session(subject: str, topics: list[dict], events: list[dict]) -> str:
    """Batch-sync a whole study session at close — the primary push path.

    topics: [{name, importance?, intuition?, definition?, notes?, prerequisites?[]}]
    events: [{type: recall|problem|explanation, concept, ...}]
      - recall:      {prompt, grade}            grade ∈ full|partial|forgotten
      - problem:     {prompt, isCorrect, partial?}
      - explanation: {content, quality?}
    Subject + topics are upserted, every event appended, then each touched concept
    is projected once. Call exactly once per session (events are append-only)."""
    body = {"subject": subject, "topics": topics, "events": events}
    try:
        r = _request("POST", "/ingest/sessions", body)
    except _Unreachable as exc:
        return str(exc)
    lines = [f"- {_outcome_line(o)}" for o in r["concepts"]]
    return f"Cerebra synced {r['subjectName']} ({len(lines)} concepts):\n" + "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
