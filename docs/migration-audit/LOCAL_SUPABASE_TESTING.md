# Local Supabase Testing

Date: 2026-09-01

## Purpose

This local environment is intended to verify authenticated Python migrations against real Supabase Auth, PostgREST, Postgres, and RLS without touching production or unknown hosted projects.

## Checkpoint 11/12 Status

Status: `BLOCKED`

Local Supabase was not feasible in this workspace during Checkpoints 11 and 12 because:

- Supabase CLI is not available on PATH.
- Docker is not available on PATH.
- `supabase/config.toml` does not exist.
- The tracked migration chain does not create `public.lesson_plans` or `saved_lessons`; see `SUPABASE_SCHEMA_DRIFT.md`.

No local Supabase runtime was started and no integration mutation was run.

## Runtime Prerequisites

Install or provide, outside this checkpoint:

- Supabase CLI
- Docker-compatible runtime required by Supabase local development
- a reconciled local schema source that can initialize `public.lesson_plans`

Do not install global tooling silently as part of a migration checkpoint.

## Checkpoint 24 Tooling Status

Date: 2026-09-03

Operating system: Windows 11 Home Single Language, 64-bit, AMD64.

`supabase/config.toml` now exists and was created with the official
project CLI (`npx supabase init --yes`). Seed loading is disabled because
this repository does not currently have a required local seed file.

Supabase CLI is now available as a project dev dependency:

```powershell
npx supabase --version
```

Verified version: `2.116.0`.

Docker is still externally blocked:

- `docker` is not on PATH.
- `npx supabase start` fails before local database mutation with `docker: command not found (podman also not found)`.
- `npx supabase db reset` cannot inspect a local database service.
- `winget show --id Docker.DockerDesktop --source winget` identifies Docker Desktop `4.89.0` from Docker Inc., but installing/running Docker Desktop requires a GUI/elevation/user step and was not performed silently.

Beginner instruction:

1. Install Docker Desktop from Docker's official Windows installer or the official `Docker.DockerDesktop` winget package.
2. Open Docker Desktop and wait until it reports that the engine is running.
3. Return to this repo and run the commands below.

This Docker requirement is only for local disposable Supabase. The Layah app itself was not containerized.

## Schema Source

Current faithful source for `lesson_plans` shape and RLS policy text: `supabase/schema.sql`.

Current migration-chain status: `lesson_plans` has a reconciliation
migration, but fresh local reset has not been live-tested. Checkpoint 12
also found representative broader drift around `saved_lessons` and
`school_templates`.

Before running local RLS tests, reconcile the migration chain and schema snapshot according to `DATABASE_SOURCE_OF_TRUTH.md`. Do not create a reduced one-table schema just to make tests pass.

Checkpoint 13 strategy: `BASELINE_PLUS_FORWARD_RECONCILIATION`.

Separate prerequisites:

| Area | Required |
| --- | --- |
| Tooling | Docker-compatible runtime and Supabase CLI. |
| Schema | Live reset proof for `lesson_plans`; canonical baseline/reconciliation for `saved_lessons` and `school_templates`; see `DATABASE_BASELINE_SPEC.md` and `SCHEMA_RECONCILIATION_PLAN.md`. |
| Test | Existing guarded RLS harness with explicit local/test/staging mutation approval flags. |

The schema blocker is distinct from the tooling blocker. Installing CLI/Docker alone does not make a local reset trustworthy until missing baseline objects are reconciled.

## Auth And PostgREST Behavior

The local runtime must expose:

- Supabase Auth at the local `/auth/v1/*` endpoints
- PostgREST at the local `/rest/v1/*` endpoints
- the anon key for caller-context requests
- the service-role key for test fixture administration only

Synthetic users should be created through Auth admin setup authority. The FastAPI request under test must receive a real synthetic user's access token.

## Safety Boundary

Integration tests remain opt-in and mutation-gated:

```powershell
$env:RUN_SUPABASE_INTEGRATION_TESTS = "1"
$env:ALLOW_SUPABASE_INTEGRATION_MUTATIONS = "1"
$env:SUPABASE_INTEGRATION_ENVIRONMENT = "local"
$env:SUPABASE_INTEGRATION_URL = "http://127.0.0.1:54321"
$env:SUPABASE_INTEGRATION_ANON_KEY = "<local-anon-key>"
$env:SUPABASE_INTEGRATION_SERVICE_ROLE_KEY = "<local-service-role-key>"
python -m pytest backend-python/tests/integration -m integration
```

`SUPABASE_INTEGRATION_ENVIRONMENT=local` now requires `SUPABASE_INTEGRATION_URL` to point to `localhost`, `127.0.0.1`, or `::1`.

## Fixture Authority Vs Application Authority

Fixture setup may use the service-role key to:

- create synthetic users
- seed User B rows for attack attempts
- read protected rows for assertions
- delete synthetic rows and users

Application mutation must not use service role. The FastAPI route must validate a real user bearer token through local Supabase Auth and forward that same caller bearer token to PostgREST.

## Expected Commands After Prerequisites

The exact commands depend on the chosen schema reconciliation strategy. The intended flow is:

```powershell
supabase start
# initialize/reset local database from reconciled canonical schema source
# verify lesson_plans columns and RLS policies
python -m pytest backend-python/tests/integration -m integration
supabase stop
```

Do not run the integration command until the schema drift is resolved.

Current simplified local workflow after Docker Desktop is running:

```powershell
npx supabase start
npx supabase db reset
$env:RUN_SUPABASE_INTEGRATION_TESTS = "1"
$env:ALLOW_SUPABASE_INTEGRATION_MUTATIONS = "1"
$env:SUPABASE_INTEGRATION_ENVIRONMENT = "local"
$env:SUPABASE_INTEGRATION_URL = "http://127.0.0.1:54321"
$env:SUPABASE_INTEGRATION_ANON_KEY = "<local-anon-key>"
$env:SUPABASE_INTEGRATION_SERVICE_ROLE_KEY = "<local-service-role-key>"
npm run test:rls
npx supabase stop
```

If Docker is not running, open Docker Desktop first. Do not manage containers, networks, volumes, or compose files manually for this workflow.

## Checkpoint 24 Re-Check

Checkpoint 24 removes the prior "no Supabase CLI / no config" local
tooling gap:

- `supabase` is pinned as a project dev dependency.
- `supabase/config.toml` is tracked for local disposable Supabase.
- `npm run test:rls` is the single project command for the existing
  guarded RLS harness.

The remaining live-test blocker is Docker Desktop. Until Docker is
installed, opened, and running, `npx supabase start` and `npx supabase db
reset` cannot reach a local database.

## Checkpoint 23 Historical Re-Check

Re-verified this checkpoint: still no Supabase CLI, still no Docker, no
`supabase/config.toml`. Unchanged from Checkpoints 11–12. The schema
blocker is now partially resolved for `lesson_plans` only —
`supabase/migrations/20260101000000_lesson_plans_baseline_reconciliation.sql`
makes `lesson_plans` reproducible from `supabase migration up` once
Docker/CLI exist — but the tooling blocker (Docker/CLI availability)
remains entirely unresolved and was not attempted, since installing
Docker is a heavyweight system-level change outside what this checkpoint
should do autonomously. See `AUTHENTICATED_BACKEND_PATTERN.md` for the
full target-classification evidence and the exact remaining steps.

## CI Suitability

Current recommendation: `LOCAL_ONLY`.

Move to `MANUAL_CI` or `AUTOMATED_CI` only after:

- a dedicated test Supabase environment or reproducible local service is available in CI
- all credentials are stored as CI secrets
- mutation opt-in flags are set only for the integration job
- cleanup is proven reliable

## Checkpoint 25 Verified Workflow

Docker Desktop is installed and running locally with the WSL2 backend.
The beginner workflow now works:

```powershell
npx supabase start
npx supabase db reset
npm run test:rls
npx supabase stop
```

For `npm run test:rls`, set the guarded integration variables from the
local Supabase output first. Do not commit those local keys.

Checkpoint 25 result:

- `npx supabase start`: passed
- `npx supabase db reset`: passed after adding the missing
  `saved_lessons` baseline reconciliation
- local Auth health: HTTP 200
- local PostgREST lesson_plans check: HTTP 200
- `npm run test:rls`: passed
