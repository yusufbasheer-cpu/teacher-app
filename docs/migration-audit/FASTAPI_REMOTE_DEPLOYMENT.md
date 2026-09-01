# FastAPI Remote Deployment — Checkpoint 19

Date: 2026-09-01

Status: **REMOTE_FASTAPI_PROVISIONED** (geo verified end-to-end remotely;
verify-captcha's contract paths verified remotely, its Turnstile provider
path deliberately not exercised — no secret configured).

## Platform

**Vercel** — chosen over the previously-documented Render preference
because Render/Railway remained completely inaccessible in-session (no
CLI, no credentials), while Vercel was authenticated and, after explicit
user authorization, could be used. See `FASTAPI_DEPLOYMENT_DECISION.md`
for the full authorization trail and the reasoning for why this
supersedes, rather than replaces, the original Render recommendation.

## Account / Team

The authenticated Vercel account is `yusufbasheer-cpu`, whose personal
account/team is labeled `teacher-app` ("Mohammed Yusuf's projects" —
confirmed via `vercel teams ls`). This is **not** a neutral shared team as
far as this session can verify. Provisioning under this identity was
explicitly authorized by the user (Uvais) mid-checkpoint before any
resource was created — see the Checkpoint 19 entry in
`MIGRATION_DECISIONS.md`.

## Project / Service

- **Project:** `layah-backend-python` (new; distinct from the existing
  `project-scquo` frontend project — confirmed unmodified before and
  after this checkpoint, same production URL `https://www.layah.in`,
  same `orgId`/project `id`).
- **Link scope:** `backend-python/.vercel/project.json` — a link local to
  that subdirectory only. The repo-root `.vercel/repo.json` (which maps
  `project-scquo`) was never touched.
- **Deploy source:** the actual repository working tree at
  `backend-python/`, uploaded via `vercel deploy --cwd backend-python`
  (46 files) — not a manually recreated copy.
- **Region:** `iad1` (Washington, D.C., USA East) — Vercel's default
  build/deploy region for this account; not explicitly chosen.
- **Runtime model:** Vercel's Python runtime auto-detected FastAPI from
  `pyproject.toml` and wraps the exported `app` object as a single Vercel
  Function (Fluid Compute by default). It does **not** run
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as a subprocess —
  Vercel imports and calls the ASGI `app` directly. Local `uvicorn` usage
  (`backend-python/README.md`) is completely unaffected; nothing in
  `app/main.py`'s `main()`/`uvicorn.run()` path is invoked by this
  deployment path.
- **Python version:** 3.12 (Vercel's default, matches
  `requires-python = ">=3.12,<3.13"`; confirmed in build log:
  `Using Python 3.12 from pyproject.toml`).
- **Build command:** `pip install .` (auto-detected, matches
  `render.yaml`'s build command — same dependency source of truth,
  `pyproject.toml`, on both platforms).
- **URL:** available via `vercel ls --cwd backend-python` or the Vercel
  dashboard (`teacher-app/layah-backend-python`). Not pasted here: the
  working deployment is a **Preview** URL (ephemeral per-deploy hash,
  changes on every redeploy) sitting behind Vercel Deployment Protection
  (bypass-token gated), so committing it buys little and this repo
  otherwise avoids committing live backend URLs (`PYTHON_BACKEND_URL`
  itself has never been persisted either, for the same reason).
- **HTTPS:** yes, Vercel-provisioned by default.

## Environment Classification

**Preview** (Vercel's own terminology) — maps directly to this
checkpoint's requested "DEVELOPMENT or PREVIEW" preference. Confirmed via
`vercel ls layah-backend-python`, which shows the working deployment's
`Environment` column as `Preview`.

A separate, **failed** deployment also exists in the `Production` slot —
an artifact of Vercel auto-targeting a brand-new project's very first
`vercel deploy` invocation to Production before the entrypoint issue
(below) was fixed. It never served working code and nothing was ever
promoted to it. No deployment has been intentionally sent to Production
in this checkpoint.

## Environment Variables

**Zero** — confirmed via `vercel env ls` (`No Environment Variables
found for teacher-app/layah-backend-python`). No Next secret, Supabase
credential, or `TURNSTILE_SECRET_KEY` was copied or configured. Geo
verified fully working with no environment variables at all, exactly as
designed.

## Narrow Platform Compatibility Fix

**EXPECTED:** Per Vercel's documented Python-entrypoint convention
("same filenames inside `src/` or `app/`"), `backend-python/app/main.py`
exporting a module-level `app` object should auto-detect with zero
config, since it matches that convention exactly.

**ACTUAL:** First deploy failed: `"Service \"layah-backend-python\"
detected framework \"fastapi\" in \".\" and must specify an
\"entrypoint\" for runtime \"python\"."`

**ROOT CAUSE:** `vercel link` wrapped the project in Vercel's "Services"
model (`vercel.json`'s `services` key), because the project was created
via CLI linking rather than a plain top-level Python project. In Services
mode, the filename-convention auto-detection does not apply the same way
— the service's `entrypoint` must be declared explicitly inside its own
`vercel.json` service config block, not (only) via `pyproject.toml`'s
`[tool.vercel.entrypoint]`.

**FIX:** Added `"entrypoint": "app.main:app"` to the `layah-backend-python`
service block in `backend-python/vercel.json`. Also kept
`[tool.vercel] entrypoint = "app.main:app"` in `pyproject.toml` — this is
Vercel's documented mechanism for the non-Services case, harmless here,
and gives explicit coverage if this project is ever restructured out of
Services mode. Only these two small config additions were made; no
application code changed, existing pytest/ruff/local-uvicorn behavior is
untouched (confirmed: `pip install --dry-run`, full pytest suite, and
ruff all still pass locally after the change).

## Remote Health / Readiness

| Check | Result | Latency (`curl`'s own `time_total`, excluding CLI wrapper overhead) |
| --- | --- | --- |
| `GET /health` | `200 {"status":"ok"}` | ~330–410ms across 3 samples |
| `GET /ready` | `200 {"status":"ready","service":"Layah Python Backend","pilot":"geo"}` | ~340–430ms across 3 samples |

Note on latency measurement: `vercel curl` (required to bypass Deployment
Protection) reports a much larger wall-clock time (~3.5–5s via shell
`time`) dominated by its own per-invocation project-lookup/auth
round-trip to Vercel's control plane — not the function's actual response
time. Isolating curl's own `%{time_total}` (measured only from when the
HTTP request itself starts) gives the figures above, which is the
meaningful number. Server-side, the function's own logged `duration_ms`
was consistently **0.4–3.5ms** — see Observability below.

## Remote Direct Geo

| Check | Result |
| --- | --- |
| `GET /api/geo` with `x-vercel-ip-country: IN` | `200 {"country_code":"IN","country_name":"IN"}`, `content-type: application/json` |
| `GET /api/geo` with no explicit header | Same result — Vercel's own edge network automatically attaches `x-vercel-ip-country` to every incoming request (including this CLI-originated one), so the deterministic header-driven path triggers naturally in production; the external-provider fallback path was not separately exercised remotely (already proven locally in Checkpoint 15/18, and would require a request Vercel doesn't geo-tag, which isn't practically reachable via `vercel curl`). |
| Latency | ~340–560ms (`curl` `time_total`), consistent across 6 samples (3 with header, 3 without) |

Content type, JSON shape, and values all match the frozen local contract
exactly.

## Remote Verify-Captcha

Contract-path verification only — the Turnstile provider path was **not**
exercised (`REMOTE_PROVIDER_PATH_NOT_EXERCISED`), per this checkpoint's
explicit instruction not to expose or configure `TURNSTILE_SECRET_KEY`
without a safe, authorized source, which wasn't available in this
session.

| Check | Result |
| --- | --- |
| `POST /api/auth/verify-captcha` with a garbage (invalid-JSON) body, no secret configured | `200 {"ok":true}` — confirms the documented "missing secret skips body parsing entirely" short-circuit works identically in the real deployment, including with a body that would otherwise fail JSON parsing. |

This is the same case as the `missing_secret_skips_turnstile` entry in
`contract-fixtures/verify-captcha/verify-captcha-contract.json` — the
most subtle ordering edge case in the frozen contract — verified
end-to-end remotely, not just locally.

## Observability

Verified via `vercel logs <deployment-url> --since 15m`. Every request
across 17+ log entries shows:

```
request method=GET path=/api/geo status=200 request_id=<hex> duration_ms=0.6
```

- Method, path, status, request ID, and duration are all clearly visible.
- No `Authorization`, `Cookie`, secret value, or environment dump appears
  anywhere in the logs.
- No startup or runtime errors in any log entry.
- Geo's own `[geo] Fetching location...` / `[geo] Location result via
  Vercel header: ...` lines (from Checkpoint 14/15) appear correctly
  interleaved with the Checkpoint 16 request-logging middleware's line,
  confirming both remain intact remotely.

## Stability Smoke Check

Across this checkpoint's verification: 4 `/health` requests, 3 `/ready`
requests, 7 `/api/geo` requests, 2 `/api/auth/verify-captcha` requests —
**17 total, all HTTP 200, no errors, no crash loop, no repeated
cold-start failure.** Not a load test; sufficient only to confirm basic
stability.

## Known Limitations

- The working deployment is a Preview URL, which changes on every
  redeploy. Checkpoint 20 will need to decide whether to target this
  specific deployment's URL, or promote to Production for a stable
  project-level alias, before configuring `PYTHON_BACKEND_URL` — not
  decided here.
- Verify-captcha's real Turnstile provider path (success/rejection
  responses from Cloudflare) remains unverified remotely.
- No custom domain was added (`layah-backend-python-teacher-app.vercel.app`
  and the per-deployment URL are the only ones in use), per this
  checkpoint's explicit scope.
- The failed "Production" deployment (see Environment Classification)
  remains in place as an inert artifact; it was not cleaned up, since
  doing so isn't required and touching the Production slot at all felt
  closer to "production" work than this checkpoint's scope intended.

## Next Required Routing Step (Checkpoint 20, not this checkpoint)

1. Decide which URL `PYTHON_BACKEND_URL` should target (see Known
   Limitations above).
2. Configure `PYTHON_BACKEND_URL` and `BACKEND_ROUTE_GEO` /
   `BACKEND_ROUTE_VERIFY_CAPTCHA` server-side on the Next/Vercel
   (`project-scquo`) side — **not done in this checkpoint.**
3. Prove Next → remote-Python routing, security isolation, latency, and
   rollback, per the same pattern already exercised locally in
   Checkpoint 15/18.
4. Decide, per endpoint, whether to reach `CUTOVER_ACTIVE`.

## Checkpoint 20 Update

Checkpoint 20 performed steps 1–3 above, with one documented deviation:
an actual `project-scquo` **Preview** deployment could not be created
(pre-existing Root Directory setting rejected by the current Vercel
CLI/API — not caused by, and not fixed by, this checkpoint, since fixing
it means modifying `project-scquo`, which is out of scope). Routing was
instead proven against local Next **development** pointed at the real
deployed backend. Full record, including a security incident (a
Protection Bypass secret was briefly exposed in tool output and
immediately rotated) and its remediation: `REMOTE_ROUTING_VALIDATION.md`.

Multiple new backend Preview deployments were created this checkpoint to
safely exercise different Turnstile test-key configurations (Cloudflare's
official public test credentials — see
`VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md`). The final resting deployment
has zero secrets configured again, matching the original zero-secret
default. Backend Deployment Protection remains fully enabled and was not
weakened — a scoped, documented bypass mechanism was added instead (see
`BACKEND_ROUTING_AND_ROLLBACK.md`).
