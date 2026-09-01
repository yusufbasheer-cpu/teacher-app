# Local Supabase Testing

Date: 2026-09-01

## Purpose

This local environment is intended to verify authenticated Python migrations against real Supabase Auth, PostgREST, Postgres, and RLS without touching production or unknown hosted projects.

## Checkpoint 11 Status

Status: `BLOCKED`

Local Supabase was not feasible in this workspace during Checkpoint 11 because:

- Supabase CLI is not available on PATH.
- Docker is not available on PATH.
- `supabase/config.toml` does not exist.
- The tracked migration chain does not create `public.lesson_plans`; see `SUPABASE_SCHEMA_DRIFT.md`.

No local Supabase runtime was started and no integration mutation was run.

## Runtime Prerequisites

Install or provide, outside this checkpoint:

- Supabase CLI
- Docker-compatible runtime required by Supabase local development
- a reconciled local schema source that can initialize `public.lesson_plans`

Do not install global tooling silently as part of a migration checkpoint.

## Schema Source

Current faithful source for `lesson_plans` shape and RLS policy text: `supabase/schema.sql`.

Current migration-chain status: incomplete for fresh local reset because the initial `lesson_plans` creation migration is missing.

Before running local RLS tests, reconcile the migration chain and schema snapshot. Do not create a reduced one-table schema just to make tests pass.

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
# initialize/reset local database from reconciled schema source
python -m pytest backend-python/tests/integration -m integration
supabase stop
```

Do not run the integration command until the schema drift is resolved.

## CI Suitability

Current recommendation: `LOCAL_ONLY`.

Move to `MANUAL_CI` or `AUTOMATED_CI` only after:

- a dedicated test Supabase environment or reproducible local service is available in CI
- all credentials are stored as CI secrets
- mutation opt-in flags are set only for the integration job
- cleanup is proven reliable
