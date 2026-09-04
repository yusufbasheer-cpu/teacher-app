# Backend Route Migration Wave 1

Date: 2026-09-04

Checkpoint: 28

Status: `BACKEND_WAVE_1_LOCAL_VERIFIED_REMOTE_AUTH_BLOCKED`

## Selection Rule

Wave 1 is limited to authenticated, caller-scoped operations that can use the
Supabase anon key plus the caller bearer token. Routes that currently depend on
service-role access, AI providers, billing, SMTP, cron, admin privilege, or an
unreconciled table are deferred.

## Selected Operations

### `GET /api/user-usage`

| Field | Contract |
| --- | --- |
| Classification | `MIGRATE_NOW` |
| Current Next handler | `src/app/api/user-usage/route.ts` |
| Auth requirement | Bearer token; Supabase Auth validation; suspended accounts return `403` |
| DB tables/functions | `user_usage`; `ensure_user_usage()` RPC |
| RLS expectation | Caller may read only their own `user_usage` row; RPC derives identity from `auth.uid()` |
| Service-role usage | None |
| Side effects | The GET may create the caller's usage row or perform its monthly reset through the idempotent RPC |
| Success contract | `200 { usage, upgradePitch }`; DB/RPC failure uses the existing free usage fail-open snapshot |
| Error contract | Missing bearer `401 { error: "Unauthorized. Please log in." }`; invalid bearer `401 { error: "Invalid session. Please log in again." }`; suspended account `403 { error }` |
| Frontend callers | `src/hooks/use-user-usage.ts`; `src/app/settings/page.tsx` |
| Python status | Parity implementation required |
| Cutover env flag | `BACKEND_ROUTE_USER_USAGE` |
| Transport failure | No automatic Next retry because the nominal GET can execute an RPC write/reset; return a stable `502` routing error |
| Safe Preview strategy | Synthetic bearer transport only unless a TEST/STAGING Supabase target exists; full behavior and RLS locally |

Reason selected: the browser contract is small, the database operation already
uses a caller-scoped security-definer RPC, and local Supabase can prove auth,
ownership, and fail-open behavior without service-role access in application
code. The hidden create/reset side effect requires no transport fallback.

### `GET /api/account/export`

| Field | Contract |
| --- | --- |
| Classification | `MIGRATE_NOW` |
| Current Next handler | `src/app/api/account/export/route.ts` |
| Auth requirement | Bearer token; Supabase Auth validation; suspended accounts return `403` |
| DB tables | `user_usage`, `lesson_plans`; Supabase Auth user metadata |
| RLS expectation | Caller can read only their own usage and lesson-plan rows |
| Service-role usage | None |
| Side effects | None; read-only JSON export |
| Success contract | `200` pretty-printed JSON; `Content-Type: application/json`; `Content-Disposition: attachment; filename="layah-my-data.json"` |
| Error contract | Same missing, invalid, and suspended auth errors as `user-usage`; existing route tolerates secondary data-query failures by returning null/empty sections |
| Frontend callers | `src/app/settings/page.tsx` |
| Python status | Parity implementation required |
| Cutover env flag | `BACKEND_ROUTE_ACCOUNT_EXPORT` |
| Transport failure | Safe to fall back to Next because the operation is read-only |
| Safe Preview strategy | Synthetic bearer transport only unless a TEST/STAGING Supabase target exists; full owned/cross-user proof locally |

Reason selected: this is a caller-owned, read-only path with no privileged key,
provider, billing, or generated binary dependency. The attachment response
headers are small enough to freeze explicitly.

### `POST /api/lesson-plan/save`

| Field | Contract |
| --- | --- |
| Classification | `MIGRATE_NOW` |
| Current Next handler | `src/app/api/lesson-plan/save/route.ts` |
| Auth requirement | Authenticated Supabase session/bearer; Python derives the user ID |
| DB tables | `lesson_plans` |
| RLS expectation | Insert/update only rows owned by `auth.uid()` |
| Service-role usage | None in application execution |
| Side effects | Insert or update lesson-plan persistence |
| Success contract | Insert `201 { action: "inserted", id }`; update `200 { action: "updated", id }` |
| Error contract | Frozen in `LESSON_PLANS_MUTATION_CONTRACT.md` |
| Frontend callers | Lesson-plan generator through the existing frontend API client |
| Python status | Parity and local authenticated RLS proof already complete |
| Cutover env flag | `BACKEND_ROUTE_LESSON_PLAN_SAVE` |
| Transport failure | Never retry or fall back to Next; return a stable `502` routing error to avoid duplicate persistence |
| Safe Preview strategy | Remote transport proof only unless TEST/STAGING exists; no hosted mutation against UNKNOWN/PRODUCTION |

Reason selected: backend parity and local RLS proof already exist. This
checkpoint only supplies the missing authenticated route seam and regression
coverage. A remote write is explicitly gated on a classified safe database.

## Deferred Candidates

| Operation | Classification | Blocker |
| --- | --- | --- |
| `GET /api/hod/me` | `DEFER` | Current data lookup uses `SUPABASE_SERVICE_ROLE_KEY`; moving it would mix privilege redesign into Wave 1. |
| `GET /api/school-admin/me` | `DEFER` | Current identity/role lookup uses service-role-backed admin logic. |
| `GET /api/school-admin` | `DEFER` | Tenant-admin authorization plus service-role dashboard reads. |
| `POST /api/auth/school-enrollment` | `DEFER` | Multi-table service-role writes, seat limits, optimistic login behavior, and rollback complexity. |
| `GET /api/school-template` | `DEFER` | Caller-scoped read, but `school_templates` is not represented by a reproducible migration. |
| `DELETE /api/school-template` | `DEFER` | Mutation plus the same unresolved schema ownership. |
| `GET /api/razorpay/subscription` | `DEFER` | Billing and service-role access. |
| `DELETE /api/account/delete` | `DEFER` | Destructive service-role operation. |

## Hosted Safety Gate

The only documented hosted Supabase project remains `UNKNOWN`; no dedicated
TEST/STAGING project is documented. Therefore:

- no hosted database mutation is permitted;
- remote authenticated application proof is blocked unless safe synthetic
  credentials and a TEST/STAGING target become available;
- local disposable Supabase owns full Auth/PostgREST/RLS verification;
- Vercel Preview may prove transport, header isolation, OpenAPI, and rollback
  without claiming hosted authenticated DB proof.

## Implementation Result

Standalone backend:

- repository: `https://github.com/yusufbasheer-cpu/layah-backend-python`
- starting SHA: `b7f2c5b0ee1b08e75f49380f700468d6adf2f466`
- final/deployed SHA: `68d7b70f1c660e5e101b999dd2a795bb15faaea4`
- commit: `feat: add authenticated account endpoints`
- new endpoints: `GET /api/user-usage`, `GET /api/account/export`
- existing endpoint retained: `POST /api/lesson-plan/save`
- application DB access: anon key plus the same caller bearer token
- service-role use in application code: none
- body/query identity: ignored; DB filters use the Auth-derived user ID

Monorepo routing:

- starting SHA: `1ddbf43539b44acab98ed34e2d9f5e986323ad3f`
- routing commit: `905d6bc8c96953150b463f3fcdf98b7fddc23c5b`
- flags: `BACKEND_ROUTE_USER_USAGE`, `BACKEND_ROUTE_ACCOUNT_EXPORT`,
  `BACKEND_ROUTE_LESSON_PLAN_SAVE`
- all flags default to Next and remain independent
- authenticated proxies forward `Authorization` deliberately
- browser `Cookie` and arbitrary headers are not forwarded
- no dynamic destination, client-selected path, or generic proxy was introduced

## Verification

Backend local and CI:

- `python -m pytest tests`: `40 passed, 2 skipped, 1 warning`
- `python -m ruff check app tests`: passed
- local `supabase start` and fresh `supabase db reset`: passed
- authenticated integration: `2 passed`; covers lesson save, usage, account
  export, suspended-account denial, caller identity, and cross-user RLS
- GitHub Actions run `33848780931`: `python` and `local-supabase-rls` passed
- `git diff --check`: passed (line-ending notices only)

Frontend local:

- focused routing tests: `4 files, 32 tests passed`
- full Vitest suite: `18 files, 152 tests passed`
- `npm run typecheck`: passed
- `npm run lint`: passed with `0` errors and `86` pre-existing warnings
- `npm run build`: passed; all browser-visible routes remain present
- `git diff --check`: passed (line-ending notices only)

## Remote Backend Preview

- URL: `https://layah-backend-python-1cdnmmjuz-teacher-app.vercel.app`
- deployment: `dpl_5t8LyeBhrxTQptKL9UcZEr5ZEv4N`
- target/state: Preview / Ready
- `/health`: `200 {"status":"ok"}`
- `/ready`: `200` existing readiness contract
- `/openapi.json`: includes all selected operations
- missing auth on both new GETs: frozen `401` response
- synthetic bearer: reached FastAPI and stopped at its unconfigured Supabase gate

The backend project has no Supabase environment variables. Its hosted database
classification is `UNKNOWN/UNCONFIGURED`; TEST/STAGING is unavailable. No
remote mutation or real authenticated hosted-data read was performed.

## Route-by-Route Preview Proof

| Operation | Python-routed Preview | Deployment | Backend evidence | Rollback |
| --- | --- | --- | --- | --- |
| `GET /api/user-usage` | `https://project-scquo-8k6fozudx-teacher-app.vercel.app` | `dpl_ExEjcCT6XqRA9fJuzFtLQtjm6CJ2` | `request_id=3a817d2db3f041b49ada96011c0d5e90` | Next response on following and final Preview |
| `GET /api/account/export` | `https://project-scquo-f5zwwp3nf-teacher-app.vercel.app` | `dpl_BZjkyrCJ5p6GTubkd3Sp7TLyNcVX` | `request_id=a70d104e9f374112b80797e16577bde3` | Next response on following and final Preview |
| `POST /api/lesson-plan/save` | `https://project-scquo-3fcmntd0q-teacher-app.vercel.app` | `dpl_GGJT9xM9de4SQYnMK8btZM3AEZRe` | `request_id=7cf9b9ea3b284bd4a0b2eafe777e90df`; stopped before DB access | Existing Next auth response on final Preview |

Final no-flag rollback:

- URL: `https://project-scquo-2nlty38s1-teacher-app.vercel.app`
- deployment: `dpl_73bju23gHLRuMopqahksDhbdDqii`
- all three operations returned through their existing Next handlers
- persistent frontend routing env matches: `0`
- protection-bypass entries remaining: `0` on both Vercel projects

## Per-Route Status

| Operation | Python parity | Local auth/RLS | Remote Preview | Rollback | Production |
| --- | --- | --- | --- | --- | --- |
| `GET /api/user-usage` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_TRANSPORT_VERIFIED_AUTH_DB_BLOCKED` | `ROLLED_BACK_TO_NEXT` | `PRODUCTION_NOT_CUT_OVER` |
| `GET /api/account/export` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_TRANSPORT_VERIFIED_AUTH_DB_BLOCKED` | `ROLLED_BACK_TO_NEXT` | `PRODUCTION_NOT_CUT_OVER` |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_COMPLETE` | `LOCAL_AUTH_VERIFIED` | `REMOTE_TRANSPORT_VERIFIED_MUTATION_BLOCKED` | `ROLLED_BACK_TO_NEXT` | `PRODUCTION_NOT_CUT_OVER` |

## Decision

Wave result: `PARTIALLY_VERIFIED`.

Final classification: `BACKEND_WAVE_1_LOCAL_VERIFIED_REMOTE_AUTH_BLOCKED`.

The standalone backend is canonical for migrated Python behavior. Next
handlers remain intact. The monorepo backend copy was not changed, and no
bidirectional sync was introduced.

Production routing, environment variables, Supabase, `layah.in`, billing,
admin, cron, PPT, and AI ownership are unchanged.

The cohort is not ready for Production cutover. The exact blocker is a
positively classified hosted TEST/STAGING Supabase target with synthetic users
and deployment-scoped Preview credentials. Recommended next checkpoint:
`SAFE STAGING AUTH FOUNDATION`, then repeat the real authenticated Preview
matrix before any Production cutover decision.

## Checkpoint 29 Addendum

The hosted safety gate above is partially resolved. The one hosted Supabase
project is no longer `UNKNOWN`; it is positively classified `PRODUCTION` and
is now denied by default in the backend integration guard.

No route status changed. All three operations remain
`PYTHON_PARITY_COMPLETE` and `LOCAL_AUTH_VERIFIED`, with remote authenticated
proof still blocked, now recorded as `REMOTE_AUTH_BLOCKED_NO_STAGING_DB`
rather than blocked by an unclassified target.

The remaining blocker is a single manual provisioning action, recorded with
its exact steps in `STAGING_AUTH_FOUNDATION.md`.
