# FastAPI Deployment Decision — Checkpoint 16

Date: 2026-09-01

## Current Deployment State

No `backend-python` deployment exists anywhere. Checkpoint 15 ran it only
as an ephemeral local `uvicorn` process for verification and stopped it
afterward. There is no live URL, no hosting account access confirmed for a
Python platform, and no CI job that builds/deploys it (before this
checkpoint).

## Candidate Platforms Found In The Repository

The only prior Python-deployment evidence in this repo is the unrelated,
currently-uncalled legacy service `python-ppt-api/` (Flask, PPT generation,
not the FastAPI migration backend). It has **both**:

- `python-ppt-api/render.yaml` (Render Blueprint)
- `python-ppt-api/railway.json` (Railway config)

Evidence from `git log --follow`: both files were added in the same single
commit (`666edc2`) and never touched again. No later commit added a real
deployed URL for this service anywhere in the repository (a commit titled
"added Python PPT API URL" turned out to only change a health-check JSON
message, not add a URL). No `.env.local`/`.env.example` variable references
a live PPT API URL, and no current TypeScript code calls it — it is dead
code today. **This means neither Render nor Railway can be read as the
team's proven, active choice** — the repository shows two candidate
configs were drafted for the sibling service, not that either was
confirmed live.

`vercel.json`/`.vercel/repo.json` confirm the Next app deploys to Vercel.
Vercel account access for this project is already established (per prior
session context), and current Vercel platform capabilities support running
Python/FastAPI directly via Fluid Compute — but this repository has never
attempted a Python deployment on Vercel, and doing so would be a new
platform-topology decision, not a documented existing convention.

## Requirements

- Runs Python/FastAPI reliably
- HTTPS
- Environment variables (server-only)
- Health checks
- Logs
- Straightforward redeploy and rollback
- Suitable foundation for later authenticated and streaming endpoints
- No Kubernetes/service mesh/multi-platform sprawl
- Reasonable separation from the Next/Vercel frontend deployment

## Selected/Recommended Platform

**Render — recommended but not yet provisioned.**

### Why Render

- Of the two candidate configs already drafted in this repo for the
  sibling Python service, `render.yaml` is the more complete and
  self-documenting: it declares `buildCommand`, `startCommand`, and
  `healthCheckPath` explicitly, whereas `railway.json` relies on Nixpacks
  auto-detection and states less of the actual runtime contract in the
  file itself. Explicitness matters here because this is a foundation
  other engineers (and future checkpoints) will read.
- Render's native Python environment installs directly from
  `pyproject.toml` via `pip install .` — no Docker required, which matters
  because Docker is confirmed unavailable in this local environment
  (checked again this checkpoint: `docker` is not on `PATH`).
- Render is a distinct platform/account from the existing Vercel
  frontend project, keeping the backend independently deployable and
  avoiding "moved FastAPI into the Next deployment to avoid choosing a
  host" — an explicitly disallowed shortcut for this migration.
- A `render.yaml` for `backend-python` was added this checkpoint
  (`backend-python/render.yaml`) and its `buildCommand` (`pip install .`)
  was validated locally via `pip install --dry-run ./backend-python`,
  which resolved cleanly to `layah-backend-python-0.1.0` with only the
  four runtime dependencies (no dev/test deps).

### Rejected / Deferred Alternatives

- **Railway** — equally plausible given the sibling service also has a
  drafted `railway.json`. Deferred because it offers no evidence-based
  reason to prefer it over Render, and choosing between two viable free/
  low-cost platforms is exactly the kind of account/cost decision this
  checkpoint is instructed not to finalize unilaterally. If Render turns
  out to be unsuitable in practice, Railway is the documented fallback —
  the buildCommand/startCommand in `render.yaml` are directly portable to
  a `railway.json` using the same commands.
- **Vercel (Python via Fluid Compute)** — technically viable and would
  reuse existing account access, but deferred because: (1) it would be a
  new platform-topology decision (co-locating the backend under the same
  Vercel org as the frontend) that changes the two-repo-hosting shape this
  migration is deliberately building toward, and (2) actually provisioning
  it requires an interactive `vercel login`/`vercel link` flow that cannot
  run in this non-interactive session (the Vercel CLI is also not
  installed locally). Worth reconsidering explicitly with the project
  owner later, not ruled out permanently.
- **Docker/self-managed VM/Kubernetes** — rejected as unnecessary
  complexity for a single small FastAPI service at this stage, and
  explicitly out of scope per this checkpoint's platform-selection
  principles.

## Cost / Credential Assumptions

None verified. Render's historical "free" plan tier is referenced in the
sibling `python-ppt-api/render.yaml` (`plan: free`), which this checkpoint's
`backend-python/render.yaml` mirrors, but current Render pricing/plan
availability was not checked against Render's live docs and is not
asserted as fact here — only copied as the same assumption the repository
already made for the sibling service. **No Render account access or API
credentials are available in this session.** No paid resource was created.

## Network Exposure Model

If deployed as drafted: a single public HTTPS web service
(`https://<service>.onrender.com` by default), reachable from the
internet. Only the Next server (via `PYTHON_BACKEND_URL`, server-only)
would call it directly for eligible routed endpoints; the browser never
calls it directly. No CORS relaxation is required or planned, since the
browser only ever talks to Next.

## Environment-Variable Model

- `PYTHON_VERSION` — pins the Render Python runtime to `3.12.10`, matching
  local development and `pyproject.toml`'s `requires-python = ">=3.12,<3.13"`.
- No other environment variable is required for the geo pilot to start or
  serve traffic — confirmed by Checkpoint 15 (zero-env-var startup) and
  reconfirmed this checkpoint (`Settings` has no required/non-defaulted
  fields).
- `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` remain optional
  settings fields used only by the (not-cutover) lesson-plan pilot, not by
  geo, and are not required at process startup.

## Health-Check Model

`GET /health` → `{"status": "ok"}`, no dependency fan-out. Used as
`healthCheckPath` in `render.yaml`. `GET /ready` exists as a secondary,
still-dependency-free readiness signal but is not required by Render's
model, which only polls one path.

## Rollback Model

Two independent layers, unchanged in intent from Checkpoint 14/15:

1. **Routing rollback** (already proven twice, local): unset/remove
   `BACKEND_ROUTE_GEO` on the Next side — no FastAPI deployment action
   needed.
2. **Deployment rollback** (platform-level, not yet exercised because
   nothing is deployed): Render keeps prior deploys and supports rolling
   back to a previous successful deploy from its dashboard/API. This is
   standard Render behavior, not something this repository configures.

## Future Authenticated Endpoint Considerations

Documented, not implemented — see `FASTAPI_DEPLOYMENT_RUNBOOK.md` and
`GEO_PYTHON_CUTOVER.md` "Future Authenticated Routing" section. In short:
authenticated routes will need Authorization forwarding, no automatic
fallback after uncertain writes, explicit timeout/idempotency policy, and
secrets scoped only to what each endpoint actually needs — none of that
changes the platform choice made here.

## Future Streaming Endpoint Considerations

Render's web services are long-lived processes (not short-lived function
invocations), so they are structurally compatible with HTTP streaming
responses in principle. This has **not been verified live** — no streaming
endpoint has been deployed or tested against Render in this or any prior
checkpoint. Treat this as an open question to verify explicitly before any
future streaming cutover, not as a proven capability.

## Known External/Manual Steps Required

1. A human with Render account access must create the account/service
   (Blueprint sync from `backend-python/render.yaml`, or manual service
   creation with Root Directory set to `backend-python`).
2. Configure `PYTHON_BACKEND_URL` on the Next deployment (Vercel project
   env vars) to point at the resulting Render URL, server-only, once a
   target exists.
3. Only then can `BACKEND_ROUTE_GEO=python` be safely enabled outside a
   local/dev environment.

None of these steps were performed in this checkpoint — they require
account access this session does not have.
