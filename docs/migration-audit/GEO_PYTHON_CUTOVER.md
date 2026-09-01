# Geo Python Cutover — Checkpoint 15

Date: 2026-09-01

## Purpose

Checkpoint 15 performs the first controlled real-service substitution for
`GET /api/geo`: deploy/run a real FastAPI instance, verify it directly, prove
the Checkpoint 14 routing seam actually reaches it, verify security and
rollback, and record the outcome. This checkpoint does not migrate any other
endpoint and does not touch the database/RLS track.

## Environment Classification

**LOCAL.**

Evidence:

- `backend-python/` has no `Dockerfile`, `Procfile`, `render.yaml`,
  `railway.json`, or any other hosting config.
- `.github/workflows/ci.yml` only builds/tests/lints the Next app; it has no
  job that builds, tests, or deploys `backend-python`.
- No `PYTHON_BACKEND_URL` or `BACKEND_ROUTE_GEO` value exists in `.env.local`
  or `.env.example`.
- The only documented way to run the FastAPI app is `backend-python/README.md`
  → `python -m uvicorn app.main:app --app-dir backend-python ...` (local run).

Per the deployment prerequisite priority in `BACKEND_ROUTING_AND_ROLLBACK.md`
and the operating principle against inventing infrastructure, this checkpoint
used **local Next + local FastAPI** as the controlled environment — the
highest-priority safe option, and the only one that currently exists.

Network exposure: **LOCAL** (loopback only, `127.0.0.1`). Nothing was exposed
publicly.

## Deployment Topology Used

- FastAPI: `python -m uvicorn app.main:app --app-dir backend-python --host 127.0.0.1 --port 8001`
  (port 8001 chosen because port 8000 was already occupied on the machine by
  an unrelated, pre-existing local service; that service was left untouched).
- Next: `npm run dev` (`next dev -p 3001`, from `package.json`).
- Routing config: server-only shell environment variables
  `BACKEND_ROUTE_GEO=python` and `PYTHON_BACKEND_URL=http://127.0.0.1:8001`,
  set only for the duration of the test process. Nothing was written to
  `.env.local`, `.env.example`, or any deployment platform config.
- Both processes were stopped at the end of verification. No process was left
  running as a persistent service.

## Health / Readiness

| Check | Result |
| --- | --- |
| `GET /health` | `200 {"status":"ok"}`, ~46ms |
| `GET /ready` | `200 {"status":"ready","service":"Layah Python Backend","pilot":"geo"}`, ~45ms |

## Direct Python `/api/geo`

| Request | Result | Latency |
| --- | --- | --- |
| No `x-vercel-ip-country` header | `200 {"country_code":"IN","country_name":"India"}` | ~1.04s (real outbound call to ipapi.co) |
| With `x-vercel-ip-country: IN` | `200 {"country_code":"IN","country_name":"IN"}` | ~51ms |

No authentication required. No Supabase call observed or possible (`geo.py`
service module has no Supabase import; `Settings` only reads
`supabase_url`/`supabase_anon_key` as unused fields for this route).

## Reference Next `/api/geo` (Python routing disabled)

| Request | Result | Latency |
| --- | --- | --- |
| No `x-vercel-ip-country` header | `200 {"country_code":"IN","country_name":"IN"}` | ~1.14s (fell through to `api.country.is`, see parity note) |
| With `x-vercel-ip-country: IN` | `200 {"country_code":"IN","country_name":"IN"}` | ~61ms |

## Semantic Contract Parity

**Pass.**

- HTTP status: both 200 for a normal request; both APIs support the same
  `content-type: application/json`.
- JSON keys/types: both return exactly `{ country_code: string, country_name: string }`.
- Vercel-header path (the production-dominant path): identical for both —
  `country_code === country_name === header value`.
- Fallback provider order and default: both try `ipapi.co`, then
  `api.country.is`, then default to `{AE, UAE}` on total failure. Confirmed
  identical by reading `src/lib/geo-service.ts` and
  `backend-python/app/services/geo.py` side by side.
- Error envelope: neither wraps the response; Next's proxy forwards Python's
  body/status/content-type unmodified (`src/app/api/geo/route.ts`).

**Known, non-blocking difference (local-only):** without a
`x-vercel-ip-country` header, the two implementations derived a different
client IP string from the same loopback request (Next observed
`::ffff:127.0.0.1`, causing an `ipapi.co` "Reserved IP Address" response and
a fallback to `api.country.is`; the direct-to-Python curl carried no
forwarding headers at all, so Python's client-IP became empty and `ipapi.co`
resolved the request using its own outbound IP instead). This is an
IP-detection artifact of the local test topology (curl vs. proxied dev
server), not a difference in code logic — both implementations use the same
provider order and the same header names. In the real deployment, Vercel
always sets `x-vercel-ip-country`, which is the deterministic, tested path
and is identical between implementations. This difference does not require a
fix and does not affect contract parity.

## Provider Behavior Parity

Confirmed same order (`ipapi.co` → `api.country.is` → `{AE, UAE}` default)
and same UAE default values in both implementations. No undocumented
difference found.

## Routing Proof

Confirmed with dual-sided evidence, not just response inspection:

- Next log: `[backend-routing] Routing endpoint { endpoint: 'geo', backend: 'python', fallback: false }`
- FastAPI's own uvicorn access log recorded the corresponding
  `GET /api/geo HTTP/1.1" 200 OK` at the same timestamp, for every routed
  request.

This proves the request path was Next `/api/geo` → routing decision → FastAPI
`/api/geo` → response forwarded through Next, not a coincidental match.

## Security Verification

- **Authorization forwarded?** No — proven by source: `buildGeoProxyHeaders`
  in `src/app/api/geo/route.ts` constructs a brand-new `Headers()` object
  containing only `Accept` plus the 3 allowlisted geo headers; it never reads
  or clones `Authorization`/`Cookie` from the incoming request. This is also
  covered by the existing Checkpoint 14 test
  (`src/app/api/geo/route.test.ts`, asserts
  `forwardedHeaders.has("authorization") === false` and
  `.has("cookie") === false`) even when the incoming request carries both.
- **Cookie forwarded?** No — same evidence as above.
- **`PYTHON_BACKEND_URL` client-visible?** No — server-only variable, no
  `NEXT_PUBLIC_` prefix, not read anywhere in `src/` outside
  `src/lib/backend-routing.ts` (server-only module, `import "server-only"`).
- **Open proxy risk?** No — the upstream path is hardcoded to `/api/geo` in
  `buildPythonBackendUrl`; no client input selects the destination.
- **CORS changes required?** No — the browser only ever calls Next; Next
  calls FastAPI server-to-server. No CORS change was made or needed.
- **Unrelated secrets required by Python?** No — FastAPI started and served
  `/health`, `/ready`, and `/api/geo` correctly with zero environment
  variables set (default `Settings` values). No Supabase, Razorpay, SMTP, or
  AI-provider secret is required for geo.

## Latency

All measurements are single-request, local-loopback approximations, not load
tests.

| Path | Approx. latency (header-driven, deterministic) |
| --- | --- |
| Next direct | ~61ms |
| FastAPI direct | ~51ms |
| Next → FastAPI routed | ~66–90ms (4 samples) |

Routed latency adds roughly 15–40ms of local proxy/network overhead over
direct FastAPI — expected for an added network hop, not a material
user-impacting regression. This does not include the ~1s external-provider
path (only exercised when no Vercel header is present, and identical in
principle on both implementations).

## Transport Fallback (tested live)

Tested by stopping the local FastAPI process (our own ephemeral test
process — no shared or production infrastructure touched) while
`BACKEND_ROUTE_GEO=python` remained set, then calling `/api/geo` again.

Result:

- Response: `200 {"country_code":"IN","country_name":"IN"}` in ~66ms.
- Next log: `[backend-routing] Python geo transport failed; falling back to Next { endpoint: 'geo', backend: 'next', fallback: true, ... }`.
- Fallback was bounded (immediate connection-refused, well under the 9000ms
  timeout), observable via logs, and Next still produced a correct,
  usable response.

## Valid Python HTTP Error (not tested live)

No safe way exists to make the real FastAPI `/api/geo` handler return a
genuine HTTP error without adding a debug-only endpoint, which is out of
scope. Per the checkpoint's operating rule, this relies on the existing
Checkpoint 14 automated test
(`src/app/api/geo/route.test.ts`, "forwards valid Python HTTP error responses
without Next fallback"), which mocks a 503 upstream response and asserts it
is forwarded as-is (status 503, body preserved, no fallback triggered).

## Rollback (tested live, mandatory)

1. Stopped the Python-routed Next process.
2. Removed `BACKEND_ROUTE_GEO`/`PYTHON_BACKEND_URL` from the shell
   environment (configuration change only — nothing in application code,
   frontend, or deployment architecture was touched).
3. Restarted Next with `npm run dev`.
4. Called `GET /api/geo` again.

Result: `200 {"country_code":"IN","country_name":"IN"}`; Next log confirmed
`backend: 'next', fallback: false`. TypeScript path served the request again,
using only a configuration change.

## Final Routing State

**NEXT.**

No `PYTHON_BACKEND_URL` or `BACKEND_ROUTE_GEO` value was ever persisted to
`.env.local`, `.env.example`, or any deployment platform configuration during
this checkpoint. All Python routing during this checkpoint was ephemeral
shell-environment configuration on locally-run, throwaway processes that were
stopped at the end of verification. The real application configuration was
never changed, so there is nothing to "leave on."

## Checkpoint Classification

**VALIDATED_BUT_LEFT_ON_NEXT.**

The routing seam, contract parity, security posture, fallback behavior, and
rollback procedure are all proven correct end-to-end. Python is not left
active because:

- No deployed FastAPI target exists yet (deployment platform for
  `backend-python` has not been chosen/provisioned).
- The only environment available was an ephemeral local process, not a
  stable/shared environment appropriate to "leave active" for real traffic.
- Choosing and provisioning a real deployment platform (Render/Railway/
  Vercel/Docker/etc.) for `backend-python` is deployment architecture work,
  which is explicitly out of scope for this checkpoint's local
  verification-only mandate.

## Checkpoint 16 Addendum

Checkpoint 16 built repository-side deployment readiness for
`backend-python` (Render Blueprint, production start command,
observability middleware, CI job — see `FASTAPI_DEPLOYMENT_DECISION.md`
and `FASTAPI_DEPLOYMENT_RUNBOOK.md`) but had **no hosting account access**
in-session for Render, Railway, or Vercel. No real deployment was created,
so none of the remote verification steps in Checkpoint 16's scope (remote
health/readiness, remote direct geo, Next→remote routing, remote rollback)
could run. Everything in this document (`GEO_PYTHON_CUTOVER.md`) remains
**LOCAL VERIFIED** only, not **REMOTE VERIFIED**. Final routing state is
unchanged: `GET /api/geo` → NEXT. Geo manifest status is unchanged:
`CUTOVER_VALIDATED`, not `CUTOVER_ACTIVE`.

## Checkpoint 17 Addendum

Checkpoint 17 attempted to establish the first real remote FastAPI
deployment and run remote health/readiness/geo/routing/rollback
verification. No Render, Railway, or Vercel account access, CLI, or
credential exists in this session, so no service was created and none of
the remote verification steps could run. Classification:
`EXTERNAL_PROVISIONING_BLOCKED`. This document remains **LOCAL VERIFIED**
only. No repository/runtime defect was found — the blocker is purely
external account access.

## Checkpoint 19 Addendum

Checkpoint 19 provisioned a real remote FastAPI target on Vercel
(project `teacher-app/layah-backend-python`, Preview environment) and
verified `GET /api/geo` directly against it: `200`, matching JSON
contract (`{"country_code":"IN","country_name":"IN"}` via the
Vercel-auto-injected `x-vercel-ip-country` header), correct content
type, clean structured logs (method/path/status/request_id/duration,
no secret leakage). This document graduates from **LOCAL VERIFIED** to
**REMOTE VERIFIED** for the direct-Python portion. Full record:
`FASTAPI_REMOTE_DEPLOYMENT.md`.

**Still not done:** Next→remote-Python routing. `PYTHON_BACKEND_URL` and
`BACKEND_ROUTE_GEO` remain unset on the Next side — this checkpoint
stopped deliberately before enabling any routing, per its own scope.
Final routing state is unchanged: `GET /api/geo` → NEXT. Manifest status:
`CUTOVER_VALIDATED_REMOTE_TARGET_READY`, not `CUTOVER_ACTIVE`.

## Known Limitations

- Verification was local-only; no preview/staging/production FastAPI
  deployment was exercised.
- The no-header IP-detection difference noted above is real but does not
  affect the deterministic, production-relevant Vercel-header path.
- Valid-Python-HTTP-error forwarding relied on existing automated test
  coverage rather than a fresh live trigger, per the no-debug-endpoint rule.
- This checkpoint does not establish CI/CD or observability for a running
  FastAPI deployment, because none exists yet — that is the natural next
  step if geo cutover is to become real (see Checkpoint 16 recommendation in
  the final report).
