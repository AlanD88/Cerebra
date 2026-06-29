# Deploying Cerebra (Vercel + Neon Postgres)

Cerebra runs as a single Vercel project backed by a Neon (serverless Postgres)
database — Cerebra's documented production target. The only thing that stays on
your machine is the lightweight MCP bridge (`mcp/cerebra_mcp.py`), which Claude
Code runs as a stdio subprocess pointed at the deployed API.

```
┌─────────────┐   stdio    ┌──────────────────────── Vercel project ───────────┐
│ Claude Code │──────────▶ │  /            → web/dist  (Vite static SPA)        │
│  (local)    │  cerebra   │  /api/v1/...  → api/index.py  (FastAPI function)   │──▶ Neon
└─────────────┘   MCP      └────────────────────────────────────────────────────┘  (Postgres)
                  │ HTTPS
                  └────────▶ https://<your-app>.vercel.app/api/v1
```

The frontend and API share one origin, so **no CORS configuration is needed** —
`web/src/lib/api.ts` keeps its default `VITE_API_BASE = /api/v1`. The app pins
the psycopg (v3) driver automatically: a bare `postgres://` / `postgresql://`
`DATABASE_URL` (what Neon/Vercel inject) is normalized to `postgresql+psycopg://`
in `config.py`, so the auto-injected value works as-is.

## Prerequisites

- A Vercel account + the `vercel` CLI (`npm i -g vercel`, then `vercel login`).
- A Neon database — easiest provisioned **through Vercel** (next step); no
  separate Neon account or CLI needed.
- This repo pushed to GitHub (`git@github.com:AlanD88/Cerebra.git`).

## 1. Create the Vercel project + Neon database

1. In the Vercel dashboard: **Add New → Project**, import `AlanD88/Cerebra`.
   Vercel reads `vercel.json` (build `web/` → `web/dist`, route `/api/*` to the
   Python function). Deploy it once — it's fine if the API 500s until the DB
   exists.
2. Open the project → **Storage → Create Database → Neon (Postgres)**. Vercel
   provisions it and **auto-injects `DATABASE_URL`** (plus `POSTGRES_*` vars)
   into the project's environment for all deployments.
3. Copy the connection string from the Neon panel — you'll use it locally to
   create the schema in the next step. Prefer the **direct** (non-pooled) string
   for the one-time migration; the app uses whatever Vercel injects at runtime.

## 2. Create the schema (and optionally seed)

Run once from your machine against Neon, reusing the API venv and the `postgres`
extra (psycopg ships a wheel for your Python — no native build):

```bash
cd api
uv pip install -e .                          # psycopg (v3) is a base dep

export DATABASE_URL='postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require'

.venv/bin/python -m app.initdb             # empty schema
# — or — load the demo Linear Algebra subject too:
.venv/bin/python -m app.seed               # create_all + seed
```

(The `postgres://`→psycopg normalization means you can paste Neon's string
verbatim.)

## 3. Deploy

If you imported via the dashboard (step 1), Vercel auto-deploys on every push to
`master`. To deploy from the CLI instead:

```bash
vercel link                                 # link to the project
vercel --prod
```

Optional — real AI scoring instead of the heuristic: add `ANTHROPIC_API_KEY` in
the project's environment variables.

> **First-deploy check.** Confirm the API path survives the rewrite: hit
> `https://<app>.vercel.app/api/v1/dashboard` and verify FastAPI matches the
> route. If the function sees the rewritten path instead of the original
> `/api/v1/...`, adjust the `rewrites` destination in `vercel.json`. This is the
> one piece that can only be validated against a live deploy.

## 4. Point the local MCP bridge at the cloud

Install the bridge deps and register it with the deployed URL (no local API needed):

```bash
api/.venv/bin/pip install -r mcp/requirements.txt   # or: uv pip install -r mcp/requirements.txt

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
   `cerebra_log_recall` writes through to Neon.

## Notes

- **Cold starts.** Neon autosuspends when idle; the first request after a pause
  pays a ~0.5s DB wake-up on top of Vercel's function cold start. Fine for a
  reflective single-user app.
- **Connections.** For a single user, Neon's **direct** connection string is
  simplest and avoids the PgBouncer prepared-statement caveat. If you ever hit
  connection limits, switch `DATABASE_URL` to Neon's **pooled** (`-pooler`)
  endpoint and add `connect_args={"prepare_threshold": None}` in `db.py`.
- **Sizing.** Cerebra is event-sourced with small text rows; a single user's
  history is tens of MB/year — comfortably inside Neon's free tier (0.5 GB,
  100 CU-hours/month with autosuspend).
- **Migrations.** Schema changes are applied out-of-band by re-running
  `app.initdb` (or an Alembic migration) against `DATABASE_URL` — never at
  request time.
- **Secrets.** `DATABASE_URL` and `ANTHROPIC_API_KEY` live only in Vercel env
  vars and your shell — never commit them (`.env` is gitignored).
```
