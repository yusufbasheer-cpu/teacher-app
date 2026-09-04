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
