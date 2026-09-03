# Authenticated Backend Pattern — Checkpoint 23

Date: 2026-09-01

## Purpose

`POST /api/lesson-plan/save` is the reference implementation for every
future authenticated, Supabase-backed FastAPI endpoint. This document
exists so a future migration wave does not re-derive: how to
authenticate, how to forward caller context, how to preserve RLS, how to
test cross-user isolation, or how to bootstrap a safe schema target. All
of the pieces below already exist in the codebase — this document
indexes and explains them, it does not introduce a new framework.

## Authenticated Request Flow

```text
Browser
  -> Supabase browser session (existing, unchanged)
  -> Authorization: Bearer <access token>
  -> Next route (today) / FastAPI route (future, once routed)
  -> Supabase Auth GET /auth/v1/user  (validates signature + expiry)
  -> derived AuthenticatedUser(user_id, access_token)
  -> PostgREST, using the SAME caller bearer token (never service-role)
  -> RLS evaluates auth.uid() = user_id on every row
```

Every step already exists and is unit-tested:

| Step | Code | Test |
| --- | --- | --- |
| Bearer extraction + Supabase Auth validation | `backend-python/app/auth/dependencies.py` (`authenticate_request`, `AuthenticatedUser`, `AuthenticationFailure`) | `backend-python/tests/test_lesson_plan.py::test_auth_validates_token_and_returns_server_derived_identity`, `::test_auth_rejects_missing_malformed_and_invalid_tokens` |
| Caller-context PostgREST forwarding | `backend-python/app/integrations/supabase.py` (`SupabaseRestClient`) | `::test_insert_payload_and_caller_token_are_preserved`, `::test_update_filters_by_authenticated_user_and_preserves_token` |
| Ownership derivation (never trust body `user_id`) | `backend-python/app/services/lesson_plan.py` (`build_lesson_plan_payload` uses `user.user_id`, not any request field) | `::test_user_a_cannot_target_user_b_row_through_update_contract` |
| End-to-end route contract | `backend-python/app/api/routes/lesson_plan.py` | `::test_route_matches_next_error_and_success_contract` |

## `authenticate_request` Is Already Endpoint-Agnostic

`backend-python/app/auth/dependencies.py` has no lesson-plan-specific
naming or logic — it takes a raw `Authorization` header value and an
`httpx.AsyncClient`, and returns `AuthenticatedUser(user_id, access_token)`
or raises `AuthenticationFailure`. **A future authenticated endpoint
reuses this module directly, unchanged.** No extraction or
generalization work was needed or done this checkpoint — it was already
correctly scoped.

## `SupabaseRestClient` Pattern (Not a Generic ORM — Deliberately)

`backend-python/app/integrations/supabase.py`'s `SupabaseRestClient` has
explicit, table-specific methods (`insert_lesson_plan`,
`update_lesson_plan`), not a generic `select`/`insert`/`update` CRUD
interface. This is intentional, not a gap: a generic repository/ORM
abstraction was explicitly out of scope for this checkpoint (and this
migration generally — see `MIGRATION_DECISIONS.md`'s repeated "keep it
explicit" pattern). **A future authenticated endpoint adds its own
explicit method(s) to this class (or a sibling class in the same module),
following the same shape**: build headers via the existing `_headers()`
helper, forward the caller's `access_token` as `Authorization`, use the
anon key as `apikey`, and raise `SupabasePersistenceError` on any
non-2xx status. Do not generalize this into a dynamic table/column
abstraction — every additional authenticated endpoint should read as
"boring explicit Python," matching this file's existing style.

## Safe Target Classification (Required Before Any Live Test)

Every Supabase target must be classified as exactly one of
`LOCAL_DISPOSABLE`, `TEST`, `STAGING`, `PRODUCTION`, or `UNKNOWN`. Only
the first three may ever be mutated. As of Checkpoint 24:

| Target | Classification | Evidence |
| --- | --- | --- |
| `.env.local` project (ref `jbwevzvtloahjoamwnjt`) | `UNKNOWN` | No repo doc or environment marker identifies it as local/test/staging. Same finding as Checkpoints 9–13; re-checked this checkpoint, unchanged. |
| Local Supabase (`supabase start`) | `LOCAL_DISPOSABLE` intended, runtime unavailable | Supabase CLI and `supabase/config.toml` are now present, but Docker/Podman is not installed/on PATH. `npx supabase start` fails before local services can start. |
| Any dedicated test/staging project | Not found | No project reference, credentials, or documentation exists in this repository for one. |

**No target this session can be safely mutated.** This is why no live
RLS/auth verification was performed — not a design gap, an external
prerequisite (see `AUTHENTICATED_DB_FOUNDATION_EXTERNALLY_BLOCKED`
below and in `MIGRATION_DECISIONS.md`).

## Schema Bootstrap Command (Once A Safe Target Exists)

```powershell
supabase start
supabase migration up   # now includes 20260101000000_lesson_plans_baseline_reconciliation.sql
# verify: select id, user_id from public.lesson_plans limit 1;  (table + RLS should exist)
```

The new baseline migration (Checkpoint 23,
`supabase/migrations/20260101000000_lesson_plans_baseline_reconciliation.sql`)
makes `lesson_plans` reproducible from a fresh migration run for the
first time — see `DATABASE_SOURCE_OF_TRUTH.md` for what this does and
does not resolve (only `lesson_plans`; `saved_lessons` and
`school_templates` remain unresolved, deliberately, per "smallest
correct reconciliation slice").

## Integration Test Command (Guarded, Fail-Closed, Unchanged This Checkpoint)

`backend-python/tests/integration/test_lesson_plan_rls.py` already
implements everything Phase E/Phase I of this checkpoint asked for —
reviewed and left unchanged, no gaps found:

```powershell
$env:RUN_SUPABASE_INTEGRATION_TESTS = "1"
$env:ALLOW_SUPABASE_INTEGRATION_MUTATIONS = "1"
$env:SUPABASE_INTEGRATION_ENVIRONMENT = "local"   # or "test" / "staging"
$env:SUPABASE_INTEGRATION_URL = "http://127.0.0.1:54321"
$env:SUPABASE_INTEGRATION_ANON_KEY = "<local-anon-key>"
$env:SUPABASE_INTEGRATION_SERVICE_ROLE_KEY = "<local-service-role-key>"
python -m pytest backend-python/tests/integration -m integration
```

Fail-closed properties (all pre-existing, verified by re-reading the
source this checkpoint):

- Skips (does not fail loudly, does not run) unless **both**
  `RUN_SUPABASE_INTEGRATION_TESTS=1` and
  `ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1` are set.
- Refuses (raises, does not silently skip) any
  `SUPABASE_INTEGRATION_ENVIRONMENT` other than `local`/`test`/`staging`.
- Refuses any `SUPABASE_INTEGRATION_URL` containing `prod`, `production`,
  or `live`.
- Refuses `local` unless the URL's host is `localhost`/`127.0.0.1`/`::1`.
- A bare `RUN_SUPABASE_INTEGRATION_TESTS=1` is never sufficient by
  itself — every other flag above is independently required.
- Synthetic users only (`rls-{label}-{uuid}@example.test`), created and
  torn down via Auth admin authority (service-role), scoped cleanup by
  `user_id` + a `testRun: "fastapi-rls-integration"` marker embedded in
  the synthetic lesson content — never touches unrelated rows/users.
- Application mutation under test (the FastAPI route itself) never
  receives or uses the service-role key — only synthetic users' real
  bearer tokens. Service-role is confined to fixture setup/teardown and
  post-operation verification (`supabase_admin` fixture), matching
  Phase E's "test administrative setup vs. application caller-context
  execution" separation exactly.
- Already tests: A-insert-own, A-update-own, B-row-untouched-by-A's
  update-attempt (asserted via direct admin fetch of the underlying row,
  not just the app response — correctly accounts for the zero-row
  false-positive-200 semantic documented in
  `LESSON_PLANS_MUTATION_CONTRACT.md`), spoofed `user_id` on insert
  (ignored), missing auth (401), invalid auth (401), and a **direct**
  PostgREST cross-user attempt bypassing the FastAPI app entirely (proves
  RLS itself, not just app-level filtering).

Ordinary `python -m pytest backend-python/tests` does not run this file's
test — it is `pytestmark = pytest.mark.integration` and lives under
`tests/integration/`, excluded from the default collection path used by
CI and local development.

## Checkpoint 24 Re-Check

Date: 2026-09-03

Starting branch was not the migration branch; the working tree was moved
back to `phase-1-boundary-stabilization` after preserving the untracked
`backend-python/` tree from `main` outside the repository.

Supabase CLI is now pinned as a project dev dependency and verified with
`npx supabase --version` = `2.116.0`.

Docker remains the active external blocker. `docker --version` and
`docker info` fail because `docker` is not installed/on PATH. `npx
supabase start` fails with `docker: command not found (podman also not
found)`, before any local database can start or mutate.

No hosted Supabase project was contacted. No RLS integration mutation
was run. The authenticated DB foundation remains architecturally ready
but not live-proven.

Updated classification: `AUTHENTICATED_DB_FOUNDATION_EXTERNALLY_BLOCKED`.

## What Remains Before Wave 2 Can Actually Migrate Authenticated Endpoints

1. A positively-classified `LOCAL_DISPOSABLE`, `TEST`, or `STAGING`
   Supabase target (Docker install, or a dedicated hosted test project —
   both external/human decisions, not something to force autonomously).
2. Once available: run the integration command above, unmodified, to get
   the first live proof of `lesson_plans` RLS + caller-context auth.
3. A routing-seam extension for Authorization forwarding — the current
   `src/lib/backend-routing.ts`/proxy pattern deliberately never forwards
   `Authorization`/`Cookie` (by design, for the public pilots). Reusing
   it for an authenticated endpoint requires a small, explicit addition
   (forward `Authorization` only for allowlisted authenticated
   endpoints, still no `Cookie`, still no client-controlled destination)
   — not built this checkpoint, since there was nothing safe to route to
   yet.
4. For any endpoint beyond `lesson_plans` (e.g. `saved_lessons`), its own
   baseline reconciliation — `saved_lessons` and `school_templates`
   remain `PARTIAL` confidence, unresolved, deliberately out of scope
   this checkpoint.
