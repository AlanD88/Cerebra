# Deploying Cerebra (Vercel + Turso)

Cerebra runs as a single Vercel project backed by a Turso (libSQL) database. The
only thing that stays on your machine is the lightweight MCP bridge
(`mcp/cerebra_mcp.py`), which Claude Code runs as a stdio subprocess pointed at
the deployed API.

```
┌─────────────┐   stdio    ┌──────────────────────── Vercel project ───────────┐
│ Claude Code │──────────▶ │  /            → web/dist  (Vite static SPA)        │
│  (local)    │  cerebra   │  /api/v1/...  → api/index.py  (FastAPI function)   │──▶ Turso
└─────────────┘   MCP      └────────────────────────────────────────────────────┘   (libSQL)
                  │ HTTPS
                  └────────▶ https://<your-app>.vercel.app/api/v1
```

The frontend and API share one origin, so **no CORS configuration is needed** —
`web/src/lib/api.ts` keeps its default `VITE_API_BASE = /api/v1`.

## Prerequisites

- A Turso account + the [`turso` CLI](https://docs.turso.tech/cli) (`turso auth login`).
- A Vercel account + the `vercel` CLI (`npm i -g vercel`, then `vercel login`).
- This repo pushed to GitHub (already done: `git@github.com:AlanD88/Cerebra.git`).

## 1. Provision the Turso database

```bash
turso db create cerebra
turso db show cerebra --url                 # → libsql://cerebra-<org>.turso.io
turso db tokens create cerebra              # → the auth token
```

Assemble the SQLAlchemy DSN (note the `sqlite+libsql://` prefix and the host from
the URL above — drop the `libsql://` scheme):

```
sqlite+libsql://cerebra-<org>.turso.io/?authToken=<token>&secure=true
```

## 2. Create the schema (and optionally seed)

Run once from your machine against Turso, reusing the API venv and the new
`turso` extra (installs the libSQL driver):

```bash
cd api
.venv/bin/pip install -e '.[turso]'         # adds sqlalchemy-libsql

export DATABASE_URL='sqlite+libsql://cerebra-<org>.turso.io/?authToken=<token>&secure=true'

.venv/bin/python -m app.initdb             # empty schema
# — or — load the demo Linear Algebra subject too:
.venv/bin/python -m app.seed               # create_all + seed
```

## 3. Deploy to Vercel

From the repo root:

```bash
vercel link                                 # create/link the project
vercel env add DATABASE_URL                 # paste the libSQL DSN (Production)
# Optional — real AI scoring instead of the heuristic:
vercel env add ANTHROPIC_API_KEY
vercel --prod                               # deploy
```

`vercel.json` already wires the build: it builds `web/` to `web/dist`, serves the
SPA, and rewrites `/api/(.*)` to the `api/index.py` function.

> **First-deploy check.** Confirm the API path survives the rewrite: hit
> `https://<app>.vercel.app/api/v1/dashboard` (or `/api/v1` docs) and verify
> FastAPI matches the route. If the function sees the rewritten path instead of
> the original `/api/v1/...`, adjust the `rewrites` destination in `vercel.json`.
> This is the one piece that can only be validated against a live deploy.

## 4. Point the local MCP bridge at the cloud

Install the bridge deps and register it with the deployed URL (no local API needed):

```bash
api/.venv/bin/pip install -r mcp/requirements.txt

claude mcp add -s user cerebra \
  -e CEREBRA_API_URL=https://<your-app>.vercel.app/api/v1 -- \
  /home/aduncan/github/Cerebra/api/.venv/bin/python \
  /home/aduncan/github/Cerebra/mcp/cerebra_mcp.py
```

(Or set `CEREBRA_API_URL` in the vault's `.mcp.json` — see `mcp/README.md`.)

## 5. Verify

1. `https://<app>.vercel.app` loads the four surfaces in the browser.
2. `https://<app>.vercel.app/api/v1/dashboard` returns projection-backed JSON.
3. From a Claude session, `cerebra_due_reviews` returns the deployed state and
   `cerebra_log_recall` writes through to Turso.

## Notes

- **Latency.** Each write runs the projection pipeline (several round-trips); on
  serverless + remote Turso expect modest cold-start/latency. Fine for a single
  user. Turso embedded replicas don't help on Vercel (ephemeral FS), so this is
  pure remote libSQL.
- **Migrations.** Schema changes are applied out-of-band by re-running
  `app.initdb` (or an Alembic migration) against `DATABASE_URL` — never at
  request time.
- **Secrets.** `DATABASE_URL` and `ANTHROPIC_API_KEY` live only in Vercel env
  vars and your shell — never commit them (`.env` is gitignored).
