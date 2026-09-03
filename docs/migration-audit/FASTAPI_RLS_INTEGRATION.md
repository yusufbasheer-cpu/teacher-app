# FastAPI RLS Integration Verification

Date: 2026-09-01

## Status

Result: `NO - blocked before mutation`

Checkpoint 9 could not run real Supabase mutation tests because the available environment could not be proven non-production.

Checkpoint 10 re-ran the environment classification step and reached the same safety result: no local, dedicated test, or controlled staging Supabase target is currently available from repository evidence. No mutation test was run.

Checkpoint 11 attempted to establish local Supabase reproducibility, but stopped before local startup because the required runtime tools are unavailable and the tracked migration chain does not create `public.lesson_plans`. See `LOCAL_SUPABASE_TESTING.md` and `SUPABASE_SCHEMA_DRIFT.md`.

Checkpoint 12 resolved the source-of-truth question as `HYBRID_TRANSITION_REQUIRED`: `schema.sql` is currently the only SQL source for the `lesson_plans` base contract, while ordered migrations are incomplete for fresh reset. No live RLS test was run.

Checkpoint 24 added the official Supabase CLI as a project dev
dependency, initialized `supabase/config.toml`, and added `npm run
test:rls` as the single command for the existing guarded RLS harness. No
live RLS test was run because Docker/Podman is still unavailable.

## Environment Inspection

Repository evidence:

- `supabase/schema.sql` exists.
- `supabase/migrations/` exists.
- `supabase/config.toml` now exists for local disposable Supabase.
- Supabase CLI is available through the project dev dependency (`npx supabase`).
- Docker was not available on PATH during Checkpoint 24.
- `supabase/config.toml` was created only after the `lesson_plans` schema-source drift had a reconciliation migration; remaining drift is still documented separately.
- The migration chain now has a `lesson_plans` reconciliation migration; `saved_lessons` still lacks a verified baseline migration.
- `.github/workflows/ci.yml` uses placeholder Supabase values for fast checks only.
- `.env.local` contains Supabase URL, anon key, and service-role key, but no `SUPABASE_ENVIRONMENT`, staging marker, test marker, or mutation approval marker.

Environment classification:

| Environment | Source | Project ref / identifier | Classification | Mutation safe? | Evidence |
| --- | --- | --- | --- | --- | --- |
| `.env.local` Supabase project | `.env.local` | `jbwevzvtloahjoamwnjt` | `UNKNOWN` | No | URL, anon key, and service-role key are present, but no repo doc or env marker identifies it as local/test/staging. |
| CI placeholder Supabase | `.github/workflows/ci.yml` | `placeholder` | `UNKNOWN` | No | Placeholder values are for fast checks only and are not a real Supabase target. |
| Local Supabase | `supabase/` directory | `teacher-app` local config | `LOCAL_DISPOSABLE` intended, runtime unavailable | No | `supabase/config.toml`, migrations, and `npx supabase` are present, but Docker/Podman is unavailable so local services cannot start. |
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

Checkpoint 12 blocker refinement:

- `lesson_plans` first appears in `supabase/schema.sql` in the first commit, not as an ordered migration.
- Representative drift also exists for `saved_lessons` and `school_templates`.
- A static SQL invariant test now guards `lesson_plans` owner RLS, but live Supabase RLS remains unverified.

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
- Resolve remaining `SUPABASE_SCHEMA_DRIFT.md` items before treating local reset as complete evidence.
- Apply the same lesson-plan schema and RLS policies from the reconciled source.
- Run with `SUPABASE_INTEGRATION_ENVIRONMENT=local`.
- Do not reduce policies just to make integration tests pass.

## Checkpoint 23 Historical Re-Check

Environment classification re-run: unchanged. `.env.local` project
(`jbwevzvtloahjoamwnjt`) remains `UNKNOWN`; no dedicated test/staging
project exists; local Supabase remains unavailable (no CLI, no Docker).
No new mutation-safe target appeared.

What changed: `lesson_plans` is now reproducible from a fresh migration
run (`20260101000000_lesson_plans_baseline_reconciliation.sql` — see
`DATABASE_SOURCE_OF_TRUTH.md` and `SCHEMA_RECONCILIATION_PLAN.md`), and
the zero-row-update false-positive-success behavior referenced implicitly
by this harness's cross-user assertions (line ~247,
`cross_user.status_code == 200` followed by verifying the *underlying
row* is untouched via direct admin fetch) is now explicitly documented
in `LESSON_PLANS_MUTATION_CONTRACT.md` — the harness already correctly
accounted for this; no harness change was needed.

The guarded integration harness itself
(`backend-python/tests/integration/test_lesson_plan_rls.py`) was
re-reviewed in full and found complete: fail-closed target guard, real
synthetic User A/B via Auth admin authority, real bearer tokens for the
route under test, service-role confined to fixture setup/teardown only,
cross-user isolation proven both through the app and via a **direct**
PostgREST call bypassing the app (proving RLS itself). No changes made —
"reuse and improve," and no gap was found to improve.

## Limitation

`POST /api/lesson-plan/save` remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`, not `PYTHON_CUTOVER_CANDIDATE`, until the guarded integration suite is run successfully against a proven non-production Supabase environment. That remains true after Checkpoint 23 — reproducibility improved, but live verification is still blocked externally (Docker/CLI/dedicated test project availability), not by anything this repository controls.

## Checkpoint 24 Re-Check

The local configuration prerequisite is now repository-side ready: `supabase/config.toml` exists, `supabase` is pinned in `package.json`, and `npm run test:rls` runs the existing guarded integration harness.

The live RLS result is still not run. `npx supabase start` fails before service startup because Docker/Podman is unavailable, and `npx supabase db reset` cannot inspect a local database service. No hosted Supabase project was contacted or mutated.

Current classification: `AUTHENTICATED_DB_FOUNDATION_EXTERNALLY_BLOCKED`.

## Checkpoint 25 Live Result

Docker Desktop is now installed and reachable. `npx supabase start`
succeeded against local project `teacher-app`, and `npx supabase db
reset` completed successfully after the missing `saved_lessons` baseline
was added.

`npm run test:rls` passed against `LOCAL_DISPOSABLE` Supabase.

Verified live:

- synthetic User A and User B were created locally
- User A and User B bearer tokens were obtained through local Supabase Auth
- FastAPI validated User A through Supabase Auth
- FastAPI derived `user_id` from the verified bearer, not the body
- PostgREST calls used the anon key plus the same caller bearer token
- service-role was confined to test fixture setup/teardown/admin
  assertions, not the normal app mutation path
- User A inserted and updated their own `lesson_plans` row
- User A could not modify User B's row through FastAPI or direct
  PostgREST
- spoofing User B's `user_id` in User A's request body did not impersonate
  User B
- missing and invalid bearer tokens returned 401

The documented zero-row update behavior remains parity-preserved:
cross-user update attempts return the existing success-shaped update
response while the underlying row remains unchanged, so the API does not
reveal whether another user's protected row exists.

Updated classification: `AUTHENTICATED_DB_FOUNDATION_VERIFIED`.
