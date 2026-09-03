# Deployment Architecture

## Next Application

- Hosting target: Vercel, inferred from `.vercel/`, `vercel.json`, README, Next config, and Vercel geo header use.
- Production deployment: README says push to `main` deploys to Vercel.
- Preview deployments: `src/proxy.ts` contains explicit notes about Vercel preview hostnames and same-origin CSRF handling.
- Build command: `npm run build`.
- Runtime: Node.js serverless/Next functions; API routes set `runtime = "nodejs"` for routes requiring Node packages.
- Cron: `vercel.json` schedules `GET /api/cron/subscription-maintenance` daily at midnight UTC.
- Security headers/CSP: configured in `next.config.ts`.
- PostHog proxy: `next.config.ts` rewrites `/ingest` to PostHog.

## CI/CD

GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests and pushes to `main`, with two independent jobs:

`build` (Node):

1. checkout
2. setup Node 22 with npm cache
3. `npm ci`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test`
7. `npm run build` with placeholder Supabase public env vars

`backend-python` (added Checkpoint 16):

1. checkout
2. setup Python 3.12
3. `pip install -e "backend-python[dev]"`
4. `python -m pytest backend-python/tests` (no `RUN_SUPABASE_INTEGRATION_TESTS`/`SUPABASE_INTEGRATION_*` env vars are set, so the networked RLS integration test self-skips, matching local behavior)
5. `python -m ruff check backend-python/app backend-python/tests`

CI does not build or deploy `backend-python` to any hosting platform — it only runs tests/lint.

## Python PPT API

`python-ppt-api` contains:

- `main.py`: Flask app.
- `requirements.txt`: Python dependencies.
- `Procfile`: likely gunicorn/start command.
- `render.yaml` and `railway.json`: possible hosting configs.

Active deployment platform cannot be proven from repository alone.

## FastAPI Backend (`backend-python/`)

Checkpoint 15 confirmed no deployment configuration existed for
`backend-python` at that time. Checkpoint 15 ran it locally on
`127.0.0.1:8001` (port 8000 was occupied by an unrelated pre-existing
local process) purely for live routing/rollback verification. The process
was stopped afterward; nothing was deployed.

Checkpoint 16 added repository-side deployment readiness:

- `backend-python/render.yaml` — a Render Blueprint (documented, not yet
  provisioned; see `FASTAPI_DEPLOYMENT_DECISION.md` for why Render was
  selected over the equally-plausible Railway, and why Vercel Python
  hosting was deferred).
- `backend-python/app/observability.py` — request-ID + timing/error
  logging middleware, wired into `app/main.py`.
- A `backend-python` job in `.github/workflows/ci.yml` (pytest + ruff;
  see CI/CD above).

No account access exists in this session for Render, Railway, or Vercel,
so **no real deployment was created**. Status:
`DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED` — see
`FASTAPI_DEPLOYMENT_RUNBOOK.md` for the exact remaining external steps.

Checkpoint 17 re-checked for Render/Railway CLI, MCP tooling, and
credentials (none found) and confirmed the blocker is unchanged: this is
purely an account-access gap, not a repository/runtime problem.

Checkpoint 19 deployed `backend-python` to **Vercel** as a new, separate
project (`teacher-app/layah-backend-python`) — Render/Railway remained
unavailable, and Vercel was used only after explicit user authorization
given the account-ownership ambiguity (the authenticated Vercel identity
is the teammate's personal account, not a neutral shared team). The
existing frontend project (`project-scquo`) is untouched — confirmed
before and after via `vercel project ls`, same production URL and
project ID. Deployment topology: `backend-python/vercel.json` defines it
as a single Vercel Service with an explicit `entrypoint` (a fix required
because Vercel's filename-convention auto-detection doesn't apply the
same way once a project is linked into Services mode — see
`FASTAPI_REMOTE_DEPLOYMENT.md` for the full EXPECTED/ACTUAL/ROOT CAUSE
record). Full verification record: `FASTAPI_REMOTE_DEPLOYMENT.md`.
Next-side routing to this deployment has **not** been enabled.

Checkpoint 20 discovered a pre-existing, unrelated `project-scquo`
configuration issue: its stored Root Directory setting (`.`) is rejected
by the current Vercel CLI/API for `vercel deploy` (non-git-integration)
invocations, blocking any local-CLI-triggered Preview deployment of the
frontend. This was not introduced by this migration work (the setting is
115+ days old).

Checkpoint 21 fixed this, now that fixing `project-scquo`'s deployment
configuration was explicitly in scope: the issue existed in two places —
`project-scquo`'s server-side project setting (`.`) and, separately, the
local machine's gitignored `.vercel/repo.json` link file (also `.` for
this project's entry, which testing showed feeds directly into the
deploy API's `rootDirectory` request field). Fixed minimally in each:
`vercel project update project-scquo --auto-detect root-directory`
server-side, and removing the local override entirely (empty string was
tried first and rejected too — the field must be a valid non-empty path
or fully absent). `project-scquo`'s identity, framework preset, and
production domain (`layah.in`) were confirmed unchanged before and after.
Real Next Preview deployments now build and deploy successfully. See
`REMOTE_ROUTING_VALIDATION.md` for the full fix record and the resulting
Preview-to-Preview validation.

## Infrastructure Gaps

- No Terraform, Pulumi, Kubernetes manifests, Dockerfile, docker-compose, nginx config, serverless config, Netlify config, or Fly config were found.
- Production/staging/preview URLs in the request were placeholders, so environment comparison was not possible.
- Secrets management is platform/environment-variable based but not fully documented in repo.

## Checkpoint 24 Local Supabase Runtime

Docker is being introduced only as the local runtime dependency for `LOCAL_DISPOSABLE` Supabase. It is not an application deployment target, and this checkpoint does not containerize Next.js, FastAPI, PPT/export, or production services.

Current local runtime status:

- Windows 11 Home x64 detected.
- Docker is not installed/on PATH; `docker --version`, `docker info`, and `npx supabase start` fail before local Supabase can start.
- Supabase CLI is project-pinned and verified through `npx supabase`.
- `npx supabase db reset` cannot run until Docker Desktop is installed, opened, and reporting a running engine.
