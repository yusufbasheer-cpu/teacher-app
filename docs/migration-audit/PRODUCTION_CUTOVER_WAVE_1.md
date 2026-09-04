# Production Cutover, Backend Wave 1

Date: 2026-09-04

Checkpoint: 30

Status: `BACKEND_WAVE_1_PRODUCTION_CUTOVER_BLOCKED`

Production routing was **not** changed. No Production frontend deployment was
created, and no route flag was enabled.

## Why The Cutover Did Not Proceed

The checkpoint assumed Production cutover is an environment-variable change.
It is not. Production runs `main`, and the routing seam does not exist there.

Three findings, each verified against `origin/main` rather than inferred.

### 1. The routing seam is absent from Production

`src/lib/backend-routing.ts` does not exist on `main`. The Production
`user-usage` and `account/export` handlers contain zero references to
`resolveBackendRoute` or any `BACKEND_ROUTE_*` variable.

Setting `BACKEND_ROUTE_USER_USAGE=python` on Production today would be inert.
The deployed code never reads it, so traffic would continue to the Next
handlers while the configuration falsely suggested a cutover had happened.
That failure mode is worse than not cutting over at all.

### 2. Production has no lesson-save API route

`src/app/api/lesson-plan/save/route.ts` does not exist on `main`. Production
persists lesson plans **client side**: `lesson-plan-generator.tsx` on `main`
calls `supabase.from("lesson_plans").update(...)` and `.insert(...)` directly
from the browser.

The migration branch introduced both the server route and the client change
that calls it. So cutting `POST /api/lesson-plan/save` over in Production is
not a routing flip at all. It requires shipping a new server route *and*
changing how the browser saves, which is a product behaviour change with its
own regression surface. It cannot be validated by toggling a flag, and it
cannot be rolled back by removing one either, because the client would still
be calling an endpoint that a rollback removes.

The Wave 1 contract document describes this route's "current Next handler" as
`src/app/api/lesson-plan/save/route.ts`. That handler is the migration
branch's own baseline. It has never been in Production.

### 3. Shipping the seam is a real merge, not a fast-forward

The migration branch is 49 commits ahead of `main` and 23 commits behind it.
Those 23 commits are live in Production and include a security hardening pass
across every file-upload and import path, covering forged content types,
decompression bombs, zip-slip, and server-side request forgery, plus a
dashboard rebuild and several PPT export fixes.

A non-mutating `git merge-tree` probe reports 8 conflicts, all in UI
components unrelated to this migration:

- `src/components/app/app-frame.tsx`
- `src/components/hod/hod-dashboard.tsx`
- `src/components/landing/lesson-plan-bento.tsx` (modify/delete)
- `src/components/layout/navbar.tsx`
- `src/components/lesson-plan/afl-selector.tsx`
- `src/components/lesson-plan/lesson-plan-loading-game.tsx`
- `src/components/lesson-plan/teacher-package-viewer.tsx`
- `src/components/ui/step-wizard-progress.tsx`

Resolving those is front-end reconciliation work, not backend migration work,
and it must not drop the security pass already in Production.

## What Was Completed

Everything that does not require shipping code to Production.

### Pre-cutover verification

| Item | Result |
| --- | --- |
| Backend repo | `main` at `c410faa`, clean, in sync with origin |
| Backend CI | green, `python` and `local-supabase-rls` |
| Frontend repo | `phase-1-boundary-stabilization` at `86428fa`, clean |
| Production Supabase reference | `jbwevzvtloahjoamwnjt`, confirmed from Production configuration |
| Next fallbacks | present and untouched |

### Production schema readiness, read only

Verified with anon-key reads only. No migration, no push, no fixture, no
write of any kind.

- `lesson_plans` returns an empty set to an anon caller, so the table exists
  and row level security is filtering.
- `saved_lessons` behaves the same way.
- `user_usage` returns an empty set, so it exists and RLS filters it.
- `ensure_user_usage` is exercised continuously by the live Production
  `user-usage` handler, which is stronger evidence of its presence than a
  probe, so no probe was sent.

**Drift finding.** On staging, `user_usage` denies an anon caller at the grant
level, returning `42501`, because the two `user_usage_lockdown` migrations are
applied there. On Production the same request returns an empty result set,
meaning those migrations are not applied and the grant is still open, with RLS
alone protecting rows.

This does not block Wave 1. Both implementations read `user_usage` with the
anon key plus the caller's bearer, and RLS is active in both environments, so
caller-scoped behaviour is identical. It does mean the staging proof ran
against a slightly stricter grant configuration than Production has, and it
confirms the known migration drift between the repository's migration chain
and the Production database. Reconciling that drift is its own task and was
not attempted here.

### Backend Production deployment established

| Item | Value |
| --- | --- |
| Vercel project | `teacher-app/layah-backend-python` |
| Source repository | `yusufbasheer-cpu/layah-backend-python`, not the monorepo copy |
| Source SHA | `c410faa` |
| Deployment | `dpl_2Z27GWG33X6Vw5m9RBSKvBLph4VA` |
| Production URL | `https://layah-backend-python-teacher-app.vercel.app` |
| Supabase target | Production, `jbwevzvtloahjoamwnjt` |
| Environment variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, Production-scoped only |
| Service-role key | not present in any deployed environment |

Smoke results, all non-destructive:

- `/health` returns `{"status":"ok"}`
- `/ready` returns the existing readiness contract
- `/openapi.json` lists all three Wave 1 operations
- both GETs return the frozen `401` bodies for a missing bearer and for an
  invalid bearer

The invalid-bearer rejection is meaningful. It proves the deployment reached
Production Supabase Auth and received a genuine rejection, so its
configuration is correct. No authenticated Production request was made, no
Production user was used, and no row was created or modified.

Preview configuration remains pointed at staging and is unaffected. Preview
and Production are separately scoped on the same project.

## Route Status

| Operation | Production status | Reason |
| --- | --- | --- |
| `GET /api/user-usage` | `PRODUCTION_CUTOVER_BLOCKED` | routing seam absent from `main` |
| `GET /api/account/export` | `PRODUCTION_CUTOVER_BLOCKED` | routing seam absent from `main` |
| `POST /api/lesson-plan/save` | `PRODUCTION_CUTOVER_BLOCKED` | route does not exist in Production; persistence is client side |

All three retain every earlier classification, up to and including
`REMOTE_AUTH_PREVIEW_VERIFIED`. Nothing regressed.

## Production Safety

- Production Supabase schema unchanged. No migration, no push, no reset.
- No synthetic user created in Production, no cross-user test run there.
- No service-role key used in any application path or deployed anywhere.
- No Production frontend deployment created, promoted, or rolled back.
- `project-scquo` has no `BACKEND_ROUTE_*` and no `PYTHON_BACKEND_URL`
  variable, and its other variables are unchanged, the newest 102 days old.
- `https://www.layah.in` is serving the same Production deployment as before.
- Staging Supabase values are not present in any Production configuration.
- Next handlers and the transitional monorepo backend copy are intact.
- No secret was printed or committed. No force push.

## Exact Remaining Work

The cutover needs a code-delivery checkpoint before it can be a configuration
checkpoint. In order:

1. Reconcile the migration branch with `main`. Merge `main` into
   `phase-1-boundary-stabilization` and resolve the 8 UI conflicts, keeping
   Production's security hardening pass intact. Verify with the full suite,
   typecheck, lint, and build.
2. Land the routing seam on `main` behind flags that default to Next, so the
   merge itself changes no behaviour. Deploy Production and confirm all three
   routes still serve from Next with no flag set.
3. Only then run the route-by-route flag cutover for `user-usage` and
   `account-export`, which is what this checkpoint was written for.
4. Treat `lesson-plan/save` separately. It is a client-behaviour migration
   from direct browser writes to a server route, and it needs its own plan
   covering the rollback path, since removing the flag does not restore the
   old client.

A useful intermediate option for step 3 is a Production deployment carrying
the seam with every flag unset. That is a genuine no-op for users and makes
the later cutover a pure configuration change with immediate rollback.

## Checkpoint 30A: Routing Seam Delivered To Production, Flags Off

Date: 2026-09-04

Status: `PRODUCTION_ROUTING_SEAM_DELIVERED_NOOP_VERIFIED`

The blocker recorded above is resolved. Production now understands the routing
flags, and nothing routes to Python.

### Delivery Strategy

Chosen: transplant the seam onto a fresh branch cut from current `main`.
Rejected: merging the migration branch.

The measurements made the choice. The seam files differ from current `main` by
733 inserted lines and **zero deletions**, and `main` has not touched any of
them since the merge base. Merging the branch instead would have pulled 50
commits of unrelated migration and UI work through 8 conflicts, next to a
security hardening pass that must survive. The transplant carries none of that
risk, and every line of it was already Preview-verified.

Delivery branch: `chore/backend-wave1-routing-seam-delivery`, cut from
`b05f730`, delivered as `acd4ab1`, fast-forwarded onto `main`.

### What Landed

Six files, all additions or additive edits:

- `src/lib/backend-routing.ts` and its test
- `src/app/api/user-usage/route.ts` and its test
- `src/app/api/account/export/route.ts` and its test

Each handler keeps its existing Next implementation untouched. The seam is a
guarded early return that only fires when the endpoint's flag is explicitly
`python` and a valid server-side `PYTHON_BACKEND_URL` resolves. Only
`Authorization` is forwarded upstream. Cookies and arbitrary headers are not,
the destination is server-controlled, and no generic proxy exists.

### What Deliberately Did Not Land

`POST /api/lesson-plan/save`, both the route and its test. Production persists
lesson plans directly from the browser, so shipping a dormant write endpoint
would add authenticated attack surface with no consumer. Production now returns
`404` for that path, exactly as before.

The future delta for that route is: the server route and its test, plus the
one-line change in `lesson-plan-generator.tsx` that swaps the direct
`supabase.from("lesson_plans")` insert and update for a call to
`/api/lesson-plan/save`. Those must ship together, because a flag rollback does
not restore the old client.

### Security Preservation

The structural guarantee is stronger than a checklist: the diff against `main`
contains zero deletions, and none of the six files is one the hardening pass
touched. Verified file by file that these remain byte-identical to `main`:

| File | State |
| --- | --- |
| `src/lib/upload-security.ts` | identical to main |
| `src/lib/upload-security.test.ts` | identical to main |
| `src/lib/pptx-template.ts` | identical to main |
| `src/app/api/lesson-plan/extract-upload/route.ts` | identical to main |
| `src/app/api/differentiated-pack/extract/route.ts` | identical to main |
| `src/app/api/school-template/upload/route.ts` | identical to main |

No conflict resolution was required, because no conflict arose.

### Validation

Run after a clean `npm ci` against `main`'s lockfile.

| Check | Result |
| --- | --- |
| Focused routing tests | 25 passed |
| Full suite | 21 files, 255 passed |
| Typecheck | clean |
| Lint | 0 errors, 88 pre-existing warnings, none from delivered files |
| Build | compiled successfully, both routes present, lesson-save absent |

The first typecheck run reported two errors from stale generated Next type
validators referencing the branch's lesson-save route. Clearing `.next`
resolved them. They were build-cache artifacts, not source.

### Production Deployment

| Item | Value |
| --- | --- |
| Deployment | `dpl_5AsQTavzhyDR8m6kZQW7KQjGNkTn` |
| Source | `main` at `acd4ab1` |
| Serving | `https://www.layah.in` |
| Route flags | none set |
| `PYTHON_BACKEND_URL` | not set |

### No-Op Proof

| Check | Result |
| --- | --- |
| `https://www.layah.in` | 200 |
| Unauthenticated user-usage | 401, frozen Next contract |
| Unauthenticated account-export | 401, frozen Next contract |
| `POST /api/lesson-plan/save` | 404, route absent as intended |
| Authenticated user-usage | 200, full expected contract shape |
| Authenticated account-export | 200, `application/json`, attachment header preserved, caller's own account only |
| Python Production Wave 1 requests during the smoke | **0** |

The authenticated smoke used the owner's own existing account. No account was
created, no lesson was written, and no other user's data was accessed.

Streamed backend Production logs captured zero requests on any Wave 1 path
throughout. That is the proof that flags off means Next.

### Wave 1 Is Now Two Different Migrations

Continuing to call all three routes equivalent flag flips would be wrong.

**Wave 1A, configuration cutover.** `GET /api/user-usage` and
`GET /api/account/export`. Both handlers are live in Production with the seam
in place. Each can be enabled independently by setting its flag plus
`PYTHON_BACKEND_URL`, and disabled again by removing the flag. Rollback is
immediate and requires no code change.

**Wave 1B, client behaviour cutover.** `POST /api/lesson-plan/save`. This
changes where the browser writes, needs the route and the client change
shipped together, and cannot be rolled back by removing a flag. It needs its
own checkpoint with its own rollback plan.

### Database Drift, Recorded Not Fixed

Classification: `KNOWN_NON_BLOCKING_SCHEMA_DRIFT`.

The two `user_usage_lockdown` migrations are applied on staging
(`esqnyktumxscyvznftlc`) but not on Production (`jbwevzvtloahjoamwnjt`). An anon
caller is denied at the grant level on staging and receives an empty set under
row level security on Production. Authenticated caller-scoped behaviour, which
is what Wave 1 depends on, is equivalent in both. No `db push` was run and no
migration was applied.

### Safety

No Production schema mutation, no migration, no staging configuration in
Production, no Python route flag enabled, no service-role key introduced
anywhere, no security behaviour lost, no force push. Next handlers are intact,
the transitional monorepo backend copy is untouched on this branch, and the
standalone backend was not modified.
