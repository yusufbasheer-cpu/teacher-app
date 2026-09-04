# Backend Routing And Rollback

Date: 2026-09-01 (Checkpoint 14), updated 2026-09-04 (Checkpoint 28)

Status: `BACKEND_WAVE_1_LOCAL_VERIFIED_REMOTE_AUTH_BLOCKED` (Checkpoint 28).

## Checkpoint 15 Live Verification

The routing seam described below was exercised live against a local FastAPI
instance (`python -m uvicorn`, loopback only). Routing selection, header
allowlisting, transport fallback, and rollback all behaved exactly as
documented here. No deployed (non-local) FastAPI target exists yet, so
Python routing was not left enabled in any persisted configuration. Full
detail: `GEO_PYTHON_CUTOVER.md`.

## Checkpoint 16 Deployment Readiness

Checkpoint 16 prepared `backend-python` for real deployment (see
`FASTAPI_DEPLOYMENT_DECISION.md`, `FASTAPI_DEPLOYMENT_RUNBOOK.md`), but no
Render/Railway/Vercel account access was available in this session, so no
deployment was created and no remote routing test occurred. This routing
seam's behavior remains verified only locally (Checkpoint 15). Nothing in
this document changed as a result — the routing mechanism itself needed no
modification, only a real target to route to.

## Checkpoint 17 Attempt

Checkpoint 17 re-confirmed the same account-access gap (no Render/Railway/
Vercel CLI, MCP tool, or credential in this session) and did not attempt
remote routing. The routing/rollback mechanism described above is
unchanged and still only verified locally.

## Checkpoint 18: Second Endpoint (`verify-captcha`)

With external provisioning still blocked, Checkpoint 18 generalized this
routing seam to a second endpoint, `POST /api/auth/verify-captcha`, to
prove the pattern extends cleanly rather than being geo-specific
plumbing. `src/lib/backend-routing.ts`'s single hardcoded `"/api/geo"`
path was replaced with two small `Record<BackendRouteEndpoint, ...>`
maps (env var name, upstream path) — still a fixed, server-controlled
allowlist, not a dynamic/generic gateway. All existing geo routing tests
pass unchanged, proving geo's behavior is byte-identical after the
generalization.

Verify-captcha's routing differs from geo in one deliberate way: **no
transport-fallback to Next.** See "Transport Fallback" below.

## Architecture

Checkpoint 28 extends the fixed allowlist to `GET /api/user-usage`,
`GET /api/account/export`, and `POST /api/lesson-plan/save`. These routes
forward only the incoming `Authorization` header needed for caller-context
authentication; browser cookies and arbitrary headers remain blocked. Local
disposable Supabase tests prove authentication, owner RLS, cross-user
isolation, suspended-user denial, and server-derived identity. Preview proved
routing and per-route rollback, but the backend Preview has no hosted Supabase
configuration, so real remote authentication and database behavior remain
blocked. Full evidence: `BACKEND_ROUTE_MIGRATION_WAVE_1.md`.

Checkpoint 14 adds a small strangler routing seam at the existing Next route boundary:

```text
Browser
  -> /api/geo
  -> Next route decision
      -> existing Next geo service
      -> FastAPI /api/geo proxy when explicitly configured
```

The browser-visible URL stays `/api/geo`. The frontend API client and components do not know which backend handled the request.

This is temporary migration infrastructure. Long term, after the backend deployment topology is chosen, frontend traffic may route directly to the final backend boundary instead of through Next.

## Default-To-Next Rule

Next remains the absolute default.

The route uses the existing Next implementation when:

- routing configuration is absent
- `BACKEND_ROUTE_GEO=next`
- `BACKEND_ROUTE_GEO` has an unknown value
- `PYTHON_BACKEND_URL` is missing
- `PYTHON_BACKEND_URL` is malformed or unsafe
- an endpoint is not explicitly allowlisted

Unknown/unapproved endpoints fail closed to Next. The client cannot choose a backend.

## Per-Endpoint Opt-In

Current allowlist: `geo`, `verify-captcha`, `user-usage`, `account-export`,
and `lesson-plan-save` (Checkpoint 28).

Server-side configuration:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PYTHON_BACKEND_URL` | Operator-controlled FastAPI base URL, shared by all allowlisted endpoints | unset |
| `BACKEND_ROUTE_GEO` | Route `GET /api/geo`; only `python` opts in | Next |
| `BACKEND_ROUTE_VERIFY_CAPTCHA` | Route `POST /api/auth/verify-captcha`; only `python` opts in | Next |
| `BACKEND_ROUTE_USER_USAGE` | Route `GET /api/user-usage`; only `python` opts in | Next |
| `BACKEND_ROUTE_ACCOUNT_EXPORT` | Route `GET /api/account/export`; only `python` opts in | Next |
| `BACKEND_ROUTE_LESSON_PLAN_SAVE` | Route `POST /api/lesson-plan/save`; only `python` opts in | Next |

No `NEXT_PUBLIC_` routing variables are used. The Python backend URL is server-only topology, not browser configuration.

One variable per migrated endpoint is intentionally simpler than a compact allowlist at this stage: each endpoint is independently eligible, and the explicit name makes accidental broad routing harder. Setting one endpoint's variable has no effect on the other — verified by an explicit isolation test in `src/lib/backend-routing.test.ts`.

## Python URL Handling

`PYTHON_BACKEND_URL` must parse as `http:` or `https:` and must not contain embedded credentials, query, or hash. HTTP remains allowed for local development; hosted production should use HTTPS.

Each allowlisted endpoint's upstream path is fixed in code via a
`Record<BackendRouteEndpoint, path>` map. Client query parameters, headers,
or request body cannot select an arbitrary target or an unlisted path.

## Timeout

The Next-to-Python geo proxy timeout is 9000 ms.

Reason: the Python geo implementation preserves the existing provider behavior, where two upstream geo providers can each take up to 4000 ms before the UAE fallback. The proxy adds a small allowance while staying bounded.

## Request Forwarding

For geo (`GET`, no body), the proxy forwards only:

- `Accept: application/json`
- `x-vercel-ip-country`
- `x-forwarded-for`
- `x-real-ip`

For verify-captcha (`POST`, has a body), the proxy forwards:

- `Content-Type: application/json`, `Accept: application/json`
- `x-forwarded-for`, `x-real-ip`
- the raw request body, unmodified (needed — it carries the CAPTCHA token)

The two public endpoints do not forward:

- `Authorization`
- `Cookie`
- arbitrary client headers
- Vercel/internal headers

Both endpoints are public and non-authenticated, so bearer/cookie forwarding is unnecessary and intentionally blocked — verified for both by dedicated tests asserting `forwardedHeaders.has("authorization") === false` / `.has("cookie") === false` even when the incoming request carries them.

## Response Behavior

For `user-usage`, `account-export`, and `lesson-plan-save`, the proxy forwards
the incoming `Authorization` header plus explicit `Accept` and, for the POST,
`Content-Type`. `lesson-plan-save` forwards the raw request body. These routes
never forward `Cookie` or arbitrary browser headers. A temporary Vercel
automation-bypass header may be added by server-side deployment configuration;
it is not sourced from the browser.

If Python returns a valid HTTP response, Next forwards:

- status
- status text
- body
- content type when present

The route does not wrap the Python response in a new envelope.

## Transport Fallback

**Geo:**

```text
Python selected + transport failure
  -> log fallback
  -> call existing Next geo service
```

Transport failure includes connection failure, DNS failure, timeout/abort, or fetch throwing before a usable response exists. Safe because geo is a pure read with no external side effect to duplicate.

**Verify-captcha: deliberately NO fallback.**

```text
Python selected + transport failure
  -> log failure (no fallback)
  -> return 502 {"ok": false, "error": "Captcha verification is temporarily unavailable. Please try again."}
```

Cloudflare Turnstile tokens are single-use. If Python's outbound call to
Turnstile succeeded (consuming the token) but the response back to Next
then failed at the transport level, a naive fallback would have Next
resubmit the same token to Turnstile again — which Turnstile would reject
as `timeout-or-duplicate`, turning an already-valid captcha completion
into a false rejection the caller never actually caused. This is exactly
the "fallback could duplicate effects or hide important semantic errors"
case, so fallback was intentionally not implemented here. Verified by
`src/app/api/auth/verify-captcha/route.test.ts`'s
`"does NOT fall back to Next on Python transport failure"` test, which
asserts `fetch` was called exactly once (the failed Python attempt, no
second call to Turnstile via Next).

Both endpoints: valid Python HTTP responses, including 4xx and 5xx, are
forwarded and do not trigger fallback. This keeps Python application
errors observable instead of silently hiding semantic defects.

This fallback model (either geo's or verify-captcha's) must not be applied
to a future mutating endpoint without the same case-by-case analysis.
Retrying or falling back after a POST/write may duplicate side effects or
corrupt quota/billing state.

For authenticated Wave 1, `account-export` may fall back to the existing Next
handler on Python transport failure because it is a caller-owned read.
`user-usage` does not fall back because its RPC can create/reset usage state.
`lesson-plan-save` does not fall back because retrying an uncertain write could
duplicate or overwrite persistence. Valid Python HTTP responses, including 4xx
and 5xx responses, never trigger fallback for any of these routes.

## Logging

Logs include:

- endpoint name
- selected backend
- fallback yes/no
- fallback failure category

Logs must not include cookies, bearer tokens, full headers, or client-provided backend targets.

No diagnostic response header is added in Checkpoint 14, so the public HTTP contract is not changed unnecessarily.

## Rollback

Operational rollback, per endpoint:

1. remove the route-specific `BACKEND_ROUTE_*` variable, or
2. set it to `next`

No frontend code change is required for operational rollback. If
`PYTHON_BACKEND_URL` is removed or malformed, every allowlisted route selects
its existing Next implementation by default. This default-routing behavior is
distinct from transport fallback after Python has already been selected.

## Security Review

Checkpoints 14, 18, and 28 verify:

- Python URL is server-only
- bearer forwarding only for the three explicitly authenticated endpoints
- no cookie forwarding
- no arbitrary proxy destination from request input
- endpoint path is fixed by code and is not client-influenceable
- no open proxy behavior
- no service-role dependency in the Python application
- caller-context Supabase access only for authenticated data routes
- no new public secrets (verify-captcha reuses the existing `TURNSTILE_SECRET_KEY` name, server-only on both Next and Python)

## Future Authenticated Routing

The first authenticated routing design is implemented for three endpoints. It
uses bearer forwarding without cookie forwarding, route-specific fallback
policy, caller-context Supabase access, and fixed server-controlled targets.
Local RLS behavior is verified. Hosted Preview cutover remains blocked until a
positively classified TEST or STAGING Supabase target is configured and real
authenticated Preview requests repeat the owner/cross-user checks.

## Future Streaming Routing

Lesson generation requires separate streaming handling:

- streaming response parity
- cancellation/disconnect propagation
- no replay after partial stream
- quota reserve/refund semantics
- persistence ordering

The geo proxy is not proof that streaming cutover is safe.

## Deployment Prerequisites

Before enabling `BACKEND_ROUTE_GEO=python` outside tests:

- deploy a compatible FastAPI backend
- configure server-only `PYTHON_BACKEND_URL`
- run smoke tests through `/api/geo`
- confirm latency overhead is acceptable
- keep rollback env change ready

## Checkpoint 20: Deployment Protection Bypass

The deployed backend (Vercel `layah-backend-python`, Preview) has
Vercel Deployment Protection (SSO) enabled by default — a Next server
routed only via `fetch()` gets blocked by Vercel's own login
interstitial. `src/lib/backend-routing.ts` gained
`applyDeploymentProtectionBypass(headers)`, called from both endpoints'
proxy-header builders: it attaches Vercel's documented
`x-vercel-protection-bypass` header, but **only** when
`PYTHON_BACKEND_BYPASS_SECRET` is explicitly set. Unset (the default,
including in production), it is a complete no-op — Deployment Protection
itself was never weakened or disabled, and this mechanism becomes
unnecessary once the backend is eventually promoted out of Preview.
Verified end-to-end against the real backend — see
`REMOTE_ROUTING_VALIDATION.md`.

This is unrelated to, and does not change, the existing
Authorization/Cookie exclusion rules above.

## Checkpoint 21: Pilot Phase Closed

Both `geo` and `verify-captcha` routing seams are now validated through
a real `project-scquo` Preview deployment routed to the real backend
Preview (not just local dev) — the same bypass mechanism above, unchanged.
**PILOT_ENDPOINT_MIGRATION_PHASE = COMPLETE.** Full record:
`REMOTE_ROUTING_VALIDATION.md`. The routing infrastructure in this
document (allowlist, header rules, fallback policies) is unchanged — this
checkpoint closed the deployment-validation gap, not the routing design.
