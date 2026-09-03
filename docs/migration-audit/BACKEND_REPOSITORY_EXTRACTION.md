# Backend Repository Extraction

Date: 2026-09-03

Checkpoint: 26

Status: `BACKEND_REPOSITORY_EXTRACTED_LOCAL_ONLY`.

## Extracted Repository

Local repository path:

`C:\Liyaah\layah-backend-python`

Initial standalone commit:

`735453de6adf2a00b0f90625ff28892f7a28f14f`

Remote status:

`REMOTE_PROVISIONING_REQUIRED`.

`gh` is not installed in this environment, and
`https://github.com/yusufbasheer-cpu/layah-backend-python.git` is not
available as a public or authenticated remote from this session. No
GitHub repository was created, no remote was added, and no push was
attempted.

## Extraction Method

The extracted repo was created as a sanitized standalone repository with
one initial commit.

Full git history was not preserved because `git-filter-repo` is not
installed and no equivalent safe history-filtering tool is available in
this environment. Secret safety took priority over copying monorepo
history into a new repository.

## Contents

The extracted repo contains:

- FastAPI app from former `backend-python/app`
- Python tests from former `backend-python/tests`
- shared contract fixtures required by backend tests
- Supabase migrations and local Supabase config required for local reset
- backend Python packaging metadata
- backend deployment config files
- standalone GitHub Actions workflow
- standalone README, `.env.example`, `.env.integration.example`,
  `.gitignore`, `package.json`, and `package-lock.json`

The extracted repo does not contain:

- Next.js app routes or UI
- AI services repository code as a separate service
- production Supabase secrets
- Vercel production routing changes
- billing, Razorpay, admin, cron, or PPT routing changes

## Standalone Adjustments

Standalone-only adjustments made in the extracted repository:

- test fixture roots now resolve inside the backend repo
- monorepo frontend-source audit tests were removed from the backend test
  suite, because they assert frontend debt rather than backend behavior
- CORS middleware allows `GET`, `POST`, and `OPTIONS` for configured
  frontend origins, matching the backend's current exposed endpoints
- `supabase/config.toml` project id is `layah-backend-python`
- comments that referenced monorepo-only paths were rewritten to describe
  contracts without depending on those paths
- CI installs Python dependencies, runs pytest and Ruff, and includes a
  local Supabase/RLS job

## Verification

Verified in the extracted repository:

- `npm install`
- `python -m pip install -e ".[dev]"`
- `python -m pytest tests` -> `29 passed, 1 skipped, 1 warning`
- `python -m ruff check app tests` -> pass
- FastAPI live smoke on `127.0.0.1:8026`
  - `GET /health` -> `200 {"status":"ok"}`
  - `GET /ready` -> `200 {"status":"ready","service":"Layah Python Backend","pilot":"geo"}`
  - `GET /openapi.json` -> `200`, with paths `/health`, `/ready`,
    `/api/geo`, `/api/lesson-plan/save`, `/api/auth/verify-captcha`
- local Supabase start
- local Supabase `db reset`
- authenticated RLS integration test -> `1 passed, 1 warning`

Verified again from a fresh local clone:

`C:\Liyaah\layah-backend-python-fresh-validation-20260903233152`

- `npm ci`
- `python -m pip install -e ".[dev]"`
- `python -m pytest tests` -> `29 passed, 1 skipped, 1 warning`
- `python -m ruff check app tests` -> pass
- FastAPI live smoke on `127.0.0.1:8027`
  - `GET /health` -> `200 {"status":"ok"}`
  - `GET /ready` -> `200 {"status":"ready","service":"Layah Python Backend","pilot":"geo"}`
  - `GET /openapi.json` -> `200`, with paths `/health`, `/ready`,
    `/api/geo`, `/api/lesson-plan/save`, `/api/auth/verify-captcha`
- local Supabase start
- local Supabase `db reset`
- authenticated RLS integration test -> `1 passed, 1 warning`

The first fresh-clone RLS command intentionally skipped because the
explicit mutation guard variables were not set. It was rerun with
`RUN_SUPABASE_INTEGRATION_TESTS=1`,
`ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1`, and
`SUPABASE_INTEGRATION_ENVIRONMENT=local`, and then passed.

All local Supabase stacks and FastAPI smoke-test processes were stopped
after verification.

## Monorepo Status

The monorepo copy of `backend-python/`, `contract-fixtures/`, and
`supabase/` remains in place as the fallback/source compatibility copy.
No production traffic was routed to the extracted repository, and no
frontend route was cut over.

Until a remote repository is provisioned and pushed, database migrations
are locally canonical in the extracted backend repo for future backend
work, with the monorepo copy retained as the transition fallback.

## Follow-Up Before Any Cutover

- create or approve the GitHub remote for `layah-backend-python`
- push `735453de6adf2a00b0f90625ff28892f7a28f14f`
- choose branch protection and CI requirements
- decide when the monorepo copy becomes read-only
- make frontend/backend routing changes only in a separate approved
  checkpoint
