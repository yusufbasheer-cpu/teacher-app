# Backend Repository Extraction

Date: 2026-09-03

Checkpoint: 26

Status: `BACKEND_REPOSITORY_REMOTE_VERIFIED`.

## Extracted Repository

Local repository path:

`C:\Liyaah\layah-backend-python`

Initial standalone commit:

`735453de6adf2a00b0f90625ff28892f7a28f14f`

Remote repository:

`https://github.com/yusufbasheer-cpu/layah-backend-python`

Final standalone commit after Checkpoint 27 README update:

`b7f2c5b0ee1b08e75f49380f700468d6adf2f466`

The repository is public, matching the current `teacher-app` repository
visibility. Default branch is `main`.

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

- grant admin permission or have the owner configure branch protection
  on `main`
- decide when the monorepo copy becomes read-only/removable
- make production frontend/backend routing changes only in a separate
  approved checkpoint

## Checkpoint 27 Remote And Preview Validation

Date: 2026-09-04

GitHub:

- `gh` version: `2.99.0`
- authenticated user: `UvaisSolanki`
- owner/org verified from the current app remote: `yusufbasheer-cpu`
- backend repo: `yusufbasheer-cpu/layah-backend-python`
- visibility: public
- default branch: `main`
- push succeeded without force
- final remote SHA: `b7f2c5b0ee1b08e75f49380f700468d6adf2f466`

GitHub Actions:

- run `33792710536` passed for the initial backend push
- run `33794030337` passed for final commit
- jobs passed: `python`, `local-supabase-rls`
- branch protection attempt failed with GitHub API `404`, consistent
  with missing admin permission for the authenticated collaborator

Vercel backend Preview:

- project: `teacher-app/layah-backend-python`
- project id: `prj_qWhDyiC6WidWmsuACuaowxOuk5xb`
- deployment id: `dpl_98kDj73AD6WtdgS1FcCR4TsUzPGs`
- Preview URL:
  `https://layah-backend-python-6l0t8ckh9-teacher-app.vercel.app`
- target: Preview
- root: `.`
- service entrypoint: `app.main:app`
- direct Preview checks passed for `/health`, `/ready`, and
  `/openapi.json`

Frontend Preview routing proof:

- project: `teacher-app/project-scquo`
- routed Preview deployment id: `dpl_9U5uBrhspkLDAQXdkjBzVf7UkH8d`
- routed Preview URL:
  `https://project-scquo-ckepw5s37-teacher-app.vercel.app`
- deployment-scoped env only:
  - `PYTHON_BACKEND_URL`
  - `BACKEND_ROUTE_GEO=python`
  - `PYTHON_BACKEND_BYPASS_SECRET`
- pilot endpoint: `GET /api/geo`
- request through frontend Preview returned
  `{"country_code":"US","country_name":"US"}` when sent synthetic
  `x-vercel-ip-country: US`
- backend logs proved the standalone backend handled
  `GET /api/geo`, including `[geo] Location result via Vercel header: US`
  and access log `path=/api/geo status=200`

Rollback proof:

- rollback Preview deployment id: `dpl_GryTd9wmjcMs2fNW2cYsqUiPbKsx`
- rollback Preview URL:
  `https://project-scquo-eb01pwk58-teacher-app.vercel.app`
- deployed without Python routing env
- same `/api/geo` request returned
  `{"country_code":"IN","country_name":"IN"}`
- backend logs showed no new backend `/api/geo` entry after rollback

Security notes:

- no persistent `PYTHON_BACKEND_URL`, `BACKEND_ROUTE_GEO`, or
  `PYTHON_BACKEND_BYPASS_SECRET` exists on `project-scquo`
- no Production deployment or Production env was modified
- a temporary backend protection-bypass value was created for Preview
  validation, then revoked; final protection status shows
  `protectionBypass: {}`
- while checking cleanup, the CLI output exposed bypass entry identifiers;
  both were treated as compromised and revoked immediately
- no secrets were committed to either repository

Vercel Git integration:

The existing backend Vercel project was linked locally to the standalone
repo and deployed from that standalone checkout. It was not permanently
connected to GitHub via `vercel git connect`, because changing the
project's Git integration could affect future Production deployment
behavior and should be made as a separate explicit owner/admin decision.
