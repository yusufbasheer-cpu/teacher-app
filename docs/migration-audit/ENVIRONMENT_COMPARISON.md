# Environment Comparison

## Status

The request contained placeholders instead of usable URLs:

- Production: `<PASTE_PRODUCTION_URL_HERE>` / `<PRODUCTION_URL>`
- Staging: `<PASTE_STAGING_URL_HERE>` / `<STAGING_URL>`
- Current branch: `<PASTE_CURRENT_BRANCH_URL_HERE>` / `<CURRENT_BRANCH_URL>`

No browser/network comparison was performed because there were no concrete deployed URLs and no credentials.

Checkpoint 11 local RLS comparison status: not run. Local Supabase is blocked by missing Supabase CLI/Docker runtime and schema-source drift for `lesson_plans`.

Checkpoint 12 local RLS comparison status: not run. Schema forensics selected `HYBRID_TRANSITION_REQUIRED`; ordered migrations are not yet sufficient for fresh local reset.

Checkpoint 14 routing comparison status: not run against deployed URLs. Routing infrastructure now exists for `GET /api/geo`, but default configuration remains Next. Python routing requires server-only `BACKEND_ROUTE_GEO=python` plus a valid `PYTHON_BACKEND_URL`; no real URLs were added or tested.

Checkpoint 15 routing comparison status: run locally only (`127.0.0.1` Next + `127.0.0.1` FastAPI), not against any deployed URL — none exists for `backend-python`. Direct Python health/readiness/geo, Next reference geo, routed geo, transport-failure fallback, and rollback were all verified live. See `GEO_PYTHON_CUTOVER.md` for full results.

Checkpoint 16 status: still no deployed URL for `backend-python` to compare against. Repository-side deployment readiness (Render Blueprint, CI, observability) was completed and locally validated (`pip install --dry-run`, full local test suite), but no remote environment exists yet, so no new environment comparison could run. See `FASTAPI_DEPLOYMENT_DECISION.md`.

Checkpoint 17 status: attempted to provision a real remote target for comparison; blocked by lack of Render/Railway/Vercel account access in this session. Still no deployed URL exists. See `FASTAPI_DEPLOYMENT_DECISION.md` Checkpoint 17 addendum.

Checkpoint 19 status: a real deployed URL now exists (Vercel, Preview environment, project `teacher-app/layah-backend-python`). Direct remote health/readiness/geo/verify-captcha(contract-only) were verified against it and matched the local baseline exactly. Next→remote-Python routing comparison still not run — `PYTHON_BACKEND_URL`/`BACKEND_ROUTE_*` remain unset on the Next side; that comparison is Checkpoint 20's job. See `FASTAPI_REMOTE_DEPLOYMENT.md`.

Checkpoint 20 status: Next→remote-Python routing comparison now run, for both endpoints, including verify-captcha's real Turnstile provider branch. Deviation: run via local Next development rather than an actual `project-scquo` Preview deployment, which is currently blocked by a pre-existing project setting outside this checkpoint's authorization to fix. Full record: `REMOTE_ROUTING_VALIDATION.md`.

## Comparison Matrix

| Feature / Behavior | Production | Staging | Current branch | Difference | Expected? | Source-code explanation | Migration implication |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Routes/navigation | Not tested | Not tested | Source found 26 pages | Unknown | Unknown | `src/app/**/page.tsx` | Need live crawl after URLs are provided. |
| API behavior | Not tested | Not tested | Source found 84 Next ops | Unknown | Unknown | `src/app/api/**/route.ts` | Need non-destructive API smoke tests. |
| Auth flow | Not tested | Not tested | Supabase OAuth/cookies via proxy | Unknown | Unknown | `src/proxy.ts`, `auth/callback` | Need test accounts. |
| AI behavior | Not tested | Not tested | DeepSeek/fal/Pexels code present | Unknown | Unknown | generation routes and image helpers | Avoid paid AI calls unless authorized. |
| Billing | Not tested | Not tested | Razorpay code present | Unknown | Unknown | `src/app/api/razorpay/**` | Use test mode/webhook replay only. |
| Console/network errors | Not tested | Not tested | Not tested | Unknown | Unknown | N/A | Requires deployed URLs and browser tooling. |

## Verification Needed

Provide production, staging, and preview URLs plus test credentials. Then run:

- unauthenticated route crawl
- login/signup/logout flow
- authenticated route crawl
- non-paid generation dry run or explicit authorized paid calls
- Razorpay test-mode checkout/webhook replay
- responsive screenshots
- network/console error capture

For geo routing verification, additionally test:

- default environment: `/api/geo` resolves through the existing Next geo service
- opt-in environment: `/api/geo` proxies to FastAPI without changing browser URL
- rollback: removing `BACKEND_ROUTE_GEO` or setting it to `next` restores Next behavior
- transport failure: Python connection failure falls back to Next for geo only

## Local RLS Test Configuration

Production and unknown hosted Supabase configuration must remain separate from local RLS test configuration.

Use `backend-python/.env.integration.example` only with a local Supabase URL such as `http://127.0.0.1:54321` after `SUPABASE_SCHEMA_DRIFT.md` is resolved. Do not copy `.env.local` hosted project credentials into the integration variables unless that project has been explicitly classified as dedicated test or controlled staging.

## Checkpoint 24 Local RLS Status

Local Supabase comparison still has not run. The Supabase CLI is now available as a project dev dependency, but Docker is not installed/running, so `npx supabase start` and `npx supabase db reset` cannot reach a local database. No hosted Supabase project was contacted or mutated; `UNKNOWN` and production targets remain untouched.

Checkpoint 24 adds the preferred single command for the existing guarded harness: `npm run test:rls`. Run it only after Docker Desktop is running, `npx supabase start` succeeds, and the `SUPABASE_INTEGRATION_*` variables point at the local disposable Supabase instance.
