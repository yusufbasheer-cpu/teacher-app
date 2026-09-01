# FastAPI Deployment Runbook — `backend-python`

Date: 2026-09-01

Status: **DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED**. Everything
below has been verified locally. No real hosting account/deployment exists
yet — see `FASTAPI_DEPLOYMENT_DECISION.md` for platform rationale and the
exact external steps still required.

## Prerequisites

- Python `3.12.10` (pinned via `pyproject.toml`'s
  `requires-python = ">=3.12,<3.13"` and `render.yaml`'s `PYTHON_VERSION`).
- No database, no external account, and no secret is required to start the
  service or serve `GET /health`, `GET /ready`, `GET /api/geo`.

## Canonical Install Method

Dependency source of truth is `backend-python/pyproject.toml` — there is
no separate `requirements.txt` and none should be added; `pip` installs
directly from `pyproject.toml`.

```powershell
# local dev, editable, with test/lint tools
python -m pip install -e backend-python[dev]

# production build (what render.yaml's buildCommand runs, from backend-python/)
pip install .
```

Verified locally this checkpoint via `pip install --dry-run ./backend-python`:
resolves to `layah-backend-python-0.1.0` with exactly the four runtime
dependencies (`fastapi`, `httpx`, `pydantic-settings`, `uvicorn`) — no
dev-only packages (`pytest`, `ruff`) are pulled into a production install.

## Canonical Production Start Command

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Run with working directory `backend-python` (Render's Root Directory
setting, or `--app-dir backend-python` if invoked from the repo root, as
local dev does per `backend-python/README.md`).

`$PORT` is read directly from the shell by Uvicorn's CLI — this is the
standard convention most PaaS platforms (Render included) use to inject
the port a service must bind. `Settings.port`/`BACKEND_PYTHON_PORT` (in
`app/config.py`) only affects the separate `python -m app.main`
convenience entrypoint, which is not what any documented deployment path
uses; that field was left untouched to avoid unnecessary config churn.

Local development is unaffected — `backend-python/README.md`'s existing
`Run locally` command already binds `0.0.0.0` and passes an explicit port.

## Environment Variables

| Variable | Required to start? | Purpose |
| --- | --- | --- |
| *(none)* | — | The process starts and serves geo with zero environment variables — verified in Checkpoint 15 and reconfirmed this checkpoint. |
| `PYTHON_VERSION` | Platform-level, not app-level | Pins Render's Python runtime to `3.12.10`. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Only for the (not-cutover) lesson-plan pilot | Optional `Settings` fields, default to empty string, never required for geo. |
| `BACKEND_PYTHON_*` prefix | Optional overrides | Any `Settings` field can be overridden via `BACKEND_PYTHON_<FIELD>`; none are mandatory. |

Do **not** copy the entire Next `.env`/`.env.local` into this service.
Specifically never set here: `SUPABASE_SERVICE_ROLE_KEY`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `DEEPSEEK_API_KEY`,
`FAL_API_KEY`/`FAL_KEY`, `PEXELS_API_KEY`, `SMTP_*`, `TURNSTILE_SECRET_KEY`,
`SUPER_ADMIN_PIN`, `SENTRY_AUTH_TOKEN`. Geo needs none of them, and this
service has never required them to run or pass its test suite.

## Health / Readiness Checks

- `GET /health` → `{"status": "ok"}`. Fast, no dependency fan-out. Used as
  the platform health-check path.
- `GET /ready` → `{"status": "ready", "service": "...", "pilot": "geo"}`.
  Also dependency-free by design — does not require Supabase or any AI
  provider, matching the current geo-only deployment scope.

## Deployment Procedure (once account access exists)

1. Create the Render web service from `backend-python/render.yaml`
   (Blueprint sync), or manually with Root Directory = `backend-python`,
   build command `pip install .`, start command
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check path
   `/health`.
2. Deploy and wait for the health check to pass.
3. Run the post-deploy smoke checks below before touching any routing
   configuration.
4. Only after smoke checks pass, set `PYTHON_BACKEND_URL` (server-only, on
   the Next/Vercel side) to the new service's HTTPS URL.
5. Set `BACKEND_ROUTE_GEO=python` (server-only, on the Next/Vercel side)
   only in a controlled/non-production environment first, per the safe
   environment priority already established in
   `BACKEND_ROUTING_AND_ROLLBACK.md`.

## Post-Deploy Smoke Checks

Against the deployed URL directly (not yet through Next):

```
curl -s -o /dev/null -w "%{http_code}\n" https://<service>/health
curl -s -o /dev/null -w "%{http_code}\n" https://<service>/ready
curl -s https://<service>/api/geo -H "x-vercel-ip-country: IN"
```

Expect `200`, `200`, and `{"country_code":"IN","country_name":"IN"}`
respectively. Compare against the local baseline in `GEO_PYTHON_CUTOVER.md`
for contract parity before enabling routing.

## Geo Routing Activation

Server-only, on the Next/Vercel deployment (never `NEXT_PUBLIC_*`):

```
PYTHON_BACKEND_URL=https://<service>
BACKEND_ROUTE_GEO=python
```

Verify via Next logs that `[backend-routing] Routing endpoint` shows
`backend: 'python'`, and ideally correlate with the deployed service's own
request log (see Logs section) to confirm the request actually reached it
— response shape alone is not sufficient proof.

## Rollback

Configuration-only, no code change, no redeploy required:

```
BACKEND_ROUTE_GEO=next
```

or remove the variable entirely. Verified twice already at the routing
layer (Checkpoint 15, local). If the FastAPI deployment itself needs to be
rolled back to a prior build, use Render's own deploy history/rollback —
independent of the routing-layer rollback above.

## Logs

Uvicorn's own access log records each request
(`"GET /api/geo HTTP/1.1" 200 OK"`). This checkpoint adds a structured
line on top via `app/observability.py`'s `request_logging_middleware`:

```
INFO backend_python.access request method=GET path=/api/geo status=200 request_id=<id> duration_ms=1.3
```

Every response also carries an `x-request-id` header — either echoed back
from a caller-supplied `x-request-id` (if present and safe: non-empty,
≤100 chars, printable ASCII) or freshly generated. This is enough to
correlate a single request's start/duration/status without building
distributed tracing. Full Next→Python request-ID propagation across the
proxy hop is **deferred** (see Observability Notes) — not needed for a
single-hop, geo-only pilot at current volume.

Unhandled exceptions are logged with method/path/request_id/duration at
`ERROR` level via `logger.exception(...)` (full traceback in the log, not
in the HTTP response), then re-raised so Starlette's default error
handling still returns a generic `500` to the client — verified by
`tests/test_observability.py::test_unhandled_exception_is_logged_but_response_stays_generic`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Health check fails immediately | Wrong start command / Root Directory not set to `backend-python`. |
| `ModuleNotFoundError: app` | Build ran from repo root instead of `backend-python`, or `pip install .` wasn't run before start. |
| Geo works directly but not through Next | `PYTHON_BACKEND_URL` malformed, or `BACKEND_ROUTE_GEO` not exactly `python` — the route fails closed to Next in both cases (see `backend-routing.ts`), so check Next's own logs for the `reason` field. |
| 502/504 through Next | Deployment cold-start or platform-level latency exceeding the 9000ms proxy timeout in `src/app/api/geo/route.ts`; check the deployed service's own logs/latency, not just Next's. |

## Security Notes

- `Authorization` and `Cookie` are never forwarded to this service for geo
  (enforced in `src/app/api/geo/route.ts`'s `buildGeoProxyHeaders`, which
  constructs a fresh header set rather than cloning the incoming request;
  covered by `src/app/api/geo/route.test.ts`).
- `PYTHON_BACKEND_URL` must stay server-only — never `NEXT_PUBLIC_*`.
- The Python-side request logger never logs header values, request
  bodies, or environment variable values — only method, path, status,
  request ID, and duration.
- Sentry: **PYTHON_SENTRY_DEFERRED**. The frontend already uses Sentry, but
  no Sentry dependency/config exists for `backend-python`, and adding one
  is more than the "trivial and non-invasive" bar this checkpoint sets.
  Platform logs plus the structured request log above are sufficient for
  a geo-only deployment.

## What NOT To Copy From The Next `.env`

Do not copy `.env.local` wholesale into this service's environment. See
the Environment Variables table above for the explicit deny-list. If a
future authenticated endpoint genuinely needs a Supabase variable, add
only that variable, scoped to that endpoint's documented requirement —
never as a blanket copy.

## Current Deployment Status

**DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED.** Repository-side
readiness (runtime, packaging, health/readiness, observability, CI,
deployment artifact) is complete and locally verified. No Render account
access exists in this session, so no real deployment was created. `GET
/api/geo` continues to serve from Next; geo's manifest status remains
`CUTOVER_VALIDATED`, not `CUTOVER_ACTIVE`.
