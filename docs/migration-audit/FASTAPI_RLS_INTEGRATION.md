# FastAPI RLS Integration Verification

Date: 2026-09-01

## Status

Result: `NO - blocked before mutation`

Checkpoint 9 could not run real Supabase mutation tests because the available environment could not be proven non-production.

Checkpoint 10 re-ran the environment classification step and reached the same safety result: no local, dedicated test, or controlled staging Supabase target is currently available from repository evidence. No mutation test was run.

Checkpoint 11 attempted to establish local Supabase reproducibility, but stopped before local startup because the required runtime tools are unavailable and the tracked migration chain does not create `public.lesson_plans`. See `LOCAL_SUPABASE_TESTING.md` and `SUPABASE_SCHEMA_DRIFT.md`.

## Environment Inspection

Repository evidence:

- `supabase/schema.sql` exists.
- `supabase/migrations/` exists.
- No `supabase/config.toml` exists.
- Supabase CLI was not available on PATH during this checkpoint.
- Docker was not available on PATH during this checkpoint.
- `supabase/config.toml` was not created because schema-source drift must be resolved first.
- The migration chain has no initial `lesson_plans` creation migration.
- `.github/workflows/ci.yml` uses placeholder Supabase values for fast checks only.
- `.env.local` contains Supabase URL, anon key, and service-role key, but no `SUPABASE_ENVIRONMENT`, staging marker, test marker, or mutation approval marker.

Environment classification:

| Environment | Source | Project ref / identifier | Classification | Mutation safe? | Evidence |
| --- | --- | --- | --- | --- | --- |
| `.env.local` Supabase project | `.env.local` | `jbwevzvtloahjoamwnjt` | `UNKNOWN` | No | URL, anon key, and service-role key are present, but no repo doc or env marker identifies it as local/test/staging. |
| CI placeholder Supabase | `.github/workflows/ci.yml` | `placeholder` | `UNKNOWN` | No | Placeholder values are for fast checks only and are not a real Supabase target. |
| Local Supabase | `supabase/` directory | none | `LOCAL` unavailable | No | `supabase/schema.sql` and migrations exist, but no `supabase/config.toml`, Supabase CLI, Docker runtime, or complete fresh-reset migration chain is available. |
| Dedicated test Supabase | repository docs/config | none | `DEDICATED_TEST` unavailable | No | No dedicated test project reference or credentials found. |
| Controlled staging Supabase | repository docs/config | none | `CONTROLLED_STAGING` unavailable | No | Staging URLs in docs are placeholders; no staging Supabase project reference found. |
| Production Supabase | repository docs/config | unknown | `UNKNOWN` | No | Production identity is not documented in repo; unknown is treated as unsafe. |

Proof it was non-production: not available.

## Safety Controls Added

Networked integration tests are separated under `backend-python/tests/integration/` and marked `integration`.

The tests require all of these before any Supabase mutation can occur:

- `RUN_SUPABASE_INTEGRATION_TESTS=1`
- `ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1`
- `SUPABASE_INTEGRATION_ENVIRONMENT=local|test|staging`
- `SUPABASE_INTEGRATION_URL`
- `SUPABASE_INTEGRATION_ANON_KEY`
- `SUPABASE_INTEGRATION_SERVICE_ROLE_KEY`

The tests refuse production-like environment names and production-like URLs containing `prod`, `production`, or `live`.

## Schema And Policy Evidence

Source inspected: `supabase/schema.sql`.

`lesson_plans` has RLS enabled:

```sql
alter table public.lesson_plans enable row level security;
```

Insert policy:

```sql
create policy "Users can insert their own lesson plans"
  on public.lesson_plans
  for insert
  with check (auth.uid() = user_id);
```

Select policy:

```sql
create policy "Users can view their own lesson plans"
  on public.lesson_plans
  for select
  using (auth.uid() = user_id);
```

Update policy:

```sql
create policy "Users can update their own lesson plans"
  on public.lesson_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Delete policy:

```sql
create policy "Users can delete their own lesson plans"
  on public.lesson_plans
  for delete
  using (auth.uid() = user_id);
```

Ownership enforcement mechanism:

- Insert ownership is enforced by RLS `WITH CHECK (auth.uid() = user_id)`.
- Update row visibility is enforced by RLS `USING (auth.uid() = user_id)`.
- Update resulting ownership is enforced by RLS `WITH CHECK (auth.uid() = user_id)`.
- Python additionally narrows update requests with `id=eq.<plan_id>` and `user_id=eq.<authenticated user>`, but that is defensive narrowing and not a substitute for RLS.
- Python builds `user_id` from the validated authenticated principal. Client-supplied `user_id` is ignored by the Pydantic model and cannot override the authenticated identity.

## Test Strategy

The integration test harness, when explicitly enabled against an isolated Supabase environment, verifies:

- synthetic User A creation through Auth admin setup authority
- synthetic User B creation through Auth admin setup authority
- real access-token acquisition through Supabase password grant
- FastAPI authenticated insert as User A
- FastAPI authenticated update as User A
- FastAPI User A attempt to update User B row
- spoofed `user_id` insert attempt
- missing-auth request
- invalid-token request
- direct PostgREST User A attempt to mutate User B row
- direct PostgREST User A attempt to insert with `user_id = User B`
- persisted database state after each relevant operation
- cleanup of synthetic lesson rows and synthetic Auth users

The service-role key is used only by the test harness for fixture administration and post-operation verification. The FastAPI mutation under test still receives only real user bearer tokens and forwards only caller auth to PostgREST.

## Explicit Command

PowerShell:

```powershell
$env:RUN_SUPABASE_INTEGRATION_TESTS = "1"
$env:ALLOW_SUPABASE_INTEGRATION_MUTATIONS = "1"
$env:SUPABASE_INTEGRATION_ENVIRONMENT = "test"
$env:SUPABASE_INTEGRATION_URL = "https://<dedicated-test-project>.supabase.co"
$env:SUPABASE_INTEGRATION_ANON_KEY = "<test-anon-key>"
$env:SUPABASE_INTEGRATION_SERVICE_ROLE_KEY = "<test-service-role-key>"
python -m pytest backend-python/tests/integration -m integration
```

Do not point these variables at production.

## Results

Real integration result: not run.

Reason: no local/dedicated test/controlled staging Supabase environment was available or safely identifiable.

Checkpoint 10 blocker:

- The only concrete hosted project discovered is `.env.local` project ref `jbwevzvtloahjoamwnjt`.
- It cannot be positively classified as non-production from repository evidence.
- Local Supabase cannot be started from current repo/tooling because `supabase/config.toml`, Supabase CLI, and Docker are unavailable.
- Creating a hosted Supabase project is outside this checkpoint and is not an automated workflow in this repository.

`POST /api/lesson-plan/save` therefore moves from plain `PYTHON_PARITY` to `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`.

Checkpoint 11 blocker:

- Local Supabase cannot currently be reproduced from tracked repo state.
- Supabase CLI is absent.
- Docker-compatible runtime is absent.
- The migration chain does not create `public.lesson_plans`; later migrations assume it already exists.
- The harness local guard was hardened so `SUPABASE_INTEGRATION_ENVIRONMENT=local` requires a localhost target.

## Auth Provider Coupling

The current FastAPI auth path validates each bearer token through Supabase Auth `/auth/v1/user`. Operational consequences:

- Auth endpoint outage can make authenticated Python requests fail.
- Auth endpoint latency is added to each authenticated Python request.
- The current route maps auth validation failures to the existing 401/500 pilot behavior.
- No caching or local JWT validation was introduced in this checkpoint.

## Logging Review

Code inspection found no FastAPI logging of bearer tokens, refresh tokens, cookies, service-role keys, anon keys, or lesson content in the lesson-plan save path. The integration test harness also does not print secrets.

## CI Strategy

Recommended status: `LOCAL_ONLY` / manual only for now.

Do not add automatic CI integration mutations until a dedicated Supabase test project or local Supabase runtime exists with isolated credentials stored as CI secrets and an explicit mutation approval marker.

Future CI classification can become `MANUAL_CI` once a dedicated test project exists. It should become `AUTOMATED_CI` only after the project is exclusively test-owned, cleanup is reliable, and secrets are stored under CI with the same explicit mutation flags.

## Reusable Test Environment Strategy

Future authenticated Python migrations should reuse this same guarded Supabase integration path rather than inventing per-endpoint environments.

Required hosted strategy:

- Provision one dedicated Supabase test project or explicitly controlled staging project.
- Apply the repository schema source of truth: first reconcile `supabase/schema.sql` and `supabase/migrations/`, then initialize the environment from the agreed source.
- Keep `lesson_plans` RLS policies identical to `supabase/schema.sql` unless a real migration changes production policy.
- Store only test-environment credentials in local shell/CI secret storage, never in docs.
- Set `SUPABASE_INTEGRATION_ENVIRONMENT` to `test` or `staging`.
- Use `RUN_SUPABASE_INTEGRATION_TESTS=1` and `ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1` for each intentional run.
- Create synthetic users through fixture setup authority.
- Use real user bearer tokens for the FastAPI requests under test.
- Clean synthetic rows by run-owned metadata and synthetic user IDs.

Required local strategy:

- Add the minimal Supabase CLI configuration needed to run Auth, PostgREST, and Postgres locally.
- Resolve `SUPABASE_SCHEMA_DRIFT.md` before adding or using that configuration.
- Apply the same lesson-plan schema and RLS policies from the reconciled source.
- Run with `SUPABASE_INTEGRATION_ENVIRONMENT=local`.
- Do not reduce policies just to make integration tests pass.

## Limitation

`POST /api/lesson-plan/save` remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`, not `PYTHON_CUTOVER_CANDIDATE`, until the guarded integration suite is run successfully against a proven non-production Supabase environment.
