# Backend Routing And Rollback

Date: 2026-09-01 (Checkpoint 14), updated 2026-09-01 (Checkpoint 15)

Status: `ROUTING_INFRASTRUCTURE_READY_FOR_GEO_ONLY`.

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

## Architecture

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

Current allowlist: `geo` only.

Server-side configuration:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PYTHON_BACKEND_URL` | Operator-controlled FastAPI base URL | unset |
| `BACKEND_ROUTE_GEO` | Route `GET /api/geo`; only `python` opts in | Next |

No `NEXT_PUBLIC_` routing variables are used. The Python backend URL is server-only topology, not browser configuration.

One variable per migrated endpoint is intentionally simpler than a compact allowlist at this stage: only one endpoint is eligible, and the explicit name makes accidental broad routing harder.

## Python URL Handling

`PYTHON_BACKEND_URL` must parse as `http:` or `https:` and must not contain embedded credentials, query, or hash. HTTP remains allowed for local development; hosted production should use HTTPS.

The geo upstream path is fixed in code as `/api/geo`. Client query parameters, headers, or request body cannot select an arbitrary target.

## Timeout

The Next-to-Python geo proxy timeout is 9000 ms.

Reason: the Python geo implementation preserves the existing provider behavior, where two upstream geo providers can each take up to 4000 ms before the UAE fallback. The proxy adds a small allowance while staying bounded.

## Request Forwarding

For geo, the proxy forwards only:

- `Accept: application/json`
- `x-vercel-ip-country`
- `x-forwarded-for`
- `x-real-ip`

It does not forward:

- `Authorization`
- `Cookie`
- arbitrary client headers
- Vercel/internal headers
- request bodies

Geo is public and non-authenticated, so bearer/cookie forwarding is unnecessary and intentionally blocked.

## Response Behavior

If Python returns a valid HTTP response, Next forwards:

- status
- status text
- body
- content type when present

The route does not wrap the Python response in a new envelope.

## Transport Fallback

For this geo pilot only:

```text
Python selected + transport failure
  -> log fallback
  -> call existing Next geo service
```

Transport failure includes connection failure, DNS failure, timeout/abort, or fetch throwing before a usable response exists.

Valid Python HTTP responses, including 4xx and 5xx, are forwarded and do not trigger fallback. This keeps Python application errors observable instead of silently hiding semantic defects.

This fallback model must not automatically be reused for mutating endpoints. Retrying or falling back after a POST/write may duplicate side effects or corrupt quota/billing state.

## Logging

Logs include:

- endpoint name
- selected backend
- fallback yes/no
- fallback failure category

Logs must not include cookies, bearer tokens, full headers, or client-provided backend targets.

No diagnostic response header is added in Checkpoint 14, so the public HTTP contract is not changed unnecessarily.

## Rollback

Operational rollback for geo:

1. remove `BACKEND_ROUTE_GEO`, or
2. set `BACKEND_ROUTE_GEO=next`

No frontend code change is required once this routing mechanism is deployed. If `PYTHON_BACKEND_URL` is removed or malformed, the route also safely falls back to Next.

## Security Review

Checkpoint 14 verifies:

- Python URL is server-only
- no bearer forwarding for geo
- no cookie forwarding for geo
- no arbitrary proxy destination from request input
- endpoint path is fixed by code
- no open proxy behavior
- no service-role dependency
- no Supabase dependency
- no new public secrets

## Future Authenticated Routing

Authenticated endpoints require a separate design.

They may need Authorization forwarding, cookie preservation, body forwarding, explicit idempotency keys, no automatic fallback after uncertain writes, and live RLS/auth verification. `POST /api/lesson-plan/save` remains blocked for cutover until the authenticated DB track is ready.

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
