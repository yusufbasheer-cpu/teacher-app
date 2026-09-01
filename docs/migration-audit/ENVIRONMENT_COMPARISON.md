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
