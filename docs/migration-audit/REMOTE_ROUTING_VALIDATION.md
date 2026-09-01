# Remote Routing Validation — Checkpoint 20

Date: 2026-09-01

## Purpose

Prove the complete remote service-substitution path — client → Next →
routing seam → remote FastAPI Preview → response through Next — for both
`GET /api/geo` and `POST /api/auth/verify-captcha`, then prove rollback.

## Important: What Was Actually Validated (read this first)

This checkpoint's instructions asked for **Next Preview → Python
Preview** validation. That could not be achieved as literally specified,
for a documented external reason (below). What was actually proven is:

**Next DEVELOPMENT (local `npm run dev`) → Python PREVIEW (real, deployed
Vercel backend) — fully validated**, using the exact same production
routing code (`src/lib/backend-routing.ts`,
`src/app/api/geo/route.ts`, `src/app/api/auth/verify-captcha/route.ts`)
that would run identically on an actual Next Preview deployment. The
routing decision, the outbound `fetch()`, the header allowlist, and the
response handling are all environment-agnostic — none of this code reads
`VERCEL_ENV` or otherwise branches on whether it's running locally or on
Vercel. The only thing not proven is the literal "both sides hosted on
Vercel" topology detail.

Do not read this as "Next Preview → Python Preview verified" — read it as
"the routing mechanism is proven correct against the real remote
backend; an actual Next Preview deployment remains blocked externally."

## Why An Actual Next Preview Could Not Be Created

`vercel deploy` (non-prod) against `project-scquo` failed consistently,
twice, with:

```
"message": "If defined, the Root Directory must be a relative path not
starting with `./` and not including `../` or other special characters."
```

`vercel project inspect project-scquo` shows the project's stored **Root
Directory** setting is literally `.` — a pre-existing configuration value
(115 days old, long before this migration work started) that the current
Vercel CLI/API's stricter validation now rejects. This is unrelated to
any Checkpoint 19/20 change and was not introduced by this work.

**This was not fixed.** Doing so would mean changing a `project-scquo`
setting, which every checkpoint in this series has been explicitly told
not to do. This is flagged as a blocker requiring a human decision (fix
via the Vercel dashboard, or accept git-integration-only deploys for this
project) — see "Human Action Required" below.

## Security Incident: Bypass Secret Exposure and Rotation

While investigating why the backend Preview (which has Vercel Deployment
Protection enabled) couldn't be reached by a server-to-server call, `vercel
project protection layah-backend-python --json` was run to inspect
protection settings. Its output — which I did not anticipate would
include the raw secret — contained the actual "Protection Bypass for
Automation" secret value, and that value appeared in my visible output.

**Remediation, all performed with the user's explicit authorization:**

1. The exposed secret was revoked (`vercel project protection disable
   layah-backend-python --protection-bypass --protection-bypass-secret
   <exposed-value>`), confirmed via a structural check
   (`protectionBypass` key count went to 0) that never printed any
   secret.
2. A fresh replacement was generated (`vercel project protection enable
   layah-backend-python --protection-bypass`) and confirmed to exist the
   same way (count check only).
3. The new secret was piped directly from one `vercel` CLI invocation
   into `vercel env add ... --value "$(...)"` via shell command
   substitution — its value was never echoed, printed, or otherwise
   displayed in any tool output, terminal text, log file, or this
   conversation, for the remainder of the checkpoint.
4. Functional correctness of the new secret was verified indirectly: the
   actual Next-to-backend routed requests (documented below) succeeded,
   which is only possible if the bypass header — built server-side from
   `PYTHON_BACKEND_BYPASS_SECRET`, never logged — was valid. A direct
   `env pull`-based verification was attempted first but is structurally
   impossible: Vercel deliberately does not include sensitive-marked
   variable values in `vercel env pull` output, by design.
5. `git status` was re-checked after every step in this sequence; no
   secret value ever landed in a repository file.

**Old value: permanently treated as compromised, revoked, unusable.
New value: functioning, confidential, never displayed.**

## Backend (`layah-backend-python`)

- Project: `teacher-app/layah-backend-python`, distinct from
  `project-scquo` (frontend), confirmed unmodified throughout (same
  production URL, same project ID, checked via `vercel project ls`
  before and after this checkpoint's work).
- Final working Preview deployment for this checkpoint:
  `layah-backend-python-8n6gm9ejv-teacher-app.vercel.app` (URL not
  committed elsewhere per prior-checkpoint convention; resolve fresh via
  `vercel ls --cwd backend-python` when needed — Preview URLs are
  ephemeral and change on every redeploy, which happened several times
  this checkpoint to safely exercise different Turnstile test-key
  configurations).
- Deployment Protection: SSO (`all_except_custom_domains`) — unchanged,
  not weakened. A "Protection Bypass for Automation" secret now exists
  for this project (rotated once, see above) and is used only by the
  optional, inert-by-default `applyDeploymentProtectionBypass()` header.
- Re-verified healthy before any routing work: `GET /health` → `200`,
  `GET /ready` → `200`, `GET /api/geo` → `200`, all matching Checkpoint
  19's contract exactly.
- Final resting state: `TURNSTILE_SECRET_KEY` removed — restored to the
  zero-secret default (same as Checkpoint 19), confirmed via one more
  redeploy and a direct request showing the missing-secret short-circuit
  again.

## Next Environment

- Project: `project-scquo` (unchanged — confirmed via `vercel project
  ls` before/after; same production URL `layah.in`, same project ID).
- Classification: **DEVELOPMENT** (local `npm run dev`), not PREVIEW —
  see "Important" section above for why. This is a known, explicit,
  documented deviation from the checkpoint's request, not a silent
  substitution.
- `layah.in` / production: **never touched**. No production environment
  variable was read, written, or deployed against.
- Local routing config used only ephemeral shell environment variables
  (`PYTHON_BACKEND_URL`, `BACKEND_ROUTE_GEO`, `BACKEND_ROUTE_VERIFY_CAPTCHA`,
  `PYTHON_BACKEND_BYPASS_SECRET`), exported per-process and never written
  to any file. Also briefly set on `project-scquo`'s Preview environment
  scope (for the abandoned attempt to actually deploy a Preview) and
  fully removed afterward, once it was clear no deployment would ever
  consume them — confirmed via `vercel env ls` showing none remain.

## Geo — Full Result

| Check | Result |
| --- | --- |
| Direct remote (`GET /health`, `/ready`, `/api/geo`) | All `200`, contract matches exactly |
| Routed (`Next local → backend Preview`) | `200 {"country_code":"IN","country_name":"IN"}`, `content-type: application/json` |
| Routing evidence | Next log: `backend: 'python', fallback: false`. Backend's own `vercel logs`: `GET /api/geo status=200 request_id=8ce1e9c9... duration_ms=4.6`, timestamp-correlated. |
| Security | Sent synthetic `Authorization: Bearer synthetic-checkpoint-token` and `Cookie: checkpoint20_synthetic_cookie=1` to the Next endpoint; confirmed absent from the backend's remote logs. `PYTHON_BACKEND_URL` never present in any client-visible env var name (`NEXT_PUBLIC_*` never used) — confirmed by grep of the codebase, not by a full bundle audit. |
| Latency | Direct backend: ~330–410ms (Checkpoint 19 baseline, reconfirmed). Routed (local Next → real backend): ~389ms for the first request. No material regression — the routing hop adds negligible overhead relative to Vercel's own edge/network latency, which dominates both measurements. |
| Rollback | Removed `BACKEND_ROUTE_GEO` from the local shell env, restarted Next, confirmed `backend: 'next', fallback: false` in logs and a correct `200` response — configuration-only, no code change, no redeploy of the backend. |

## Verify-Captcha — Full Result

Full safe test matrix exercised, all through the actual Next routing
path (not just direct backend calls), using Cloudflare's official public
Turnstile test credentials (verified from Cloudflare's own documentation
before use — see `VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md` for the
values and source):

| Case | Result | Evidence |
| --- | --- | --- |
| Missing secret (short-circuit) | `200 {"ok":true}` even with a garbage body, direct-to-backend | Confirmed in Checkpoint 19; re-confirmed as the final resting state this checkpoint |
| Invalid JSON | `400 {"ok":false,"error":"Invalid request."}` | Routed through Next; backend log `status=400` |
| Missing token | `400 {"ok":false,"error":"Missing captcha token."}` | Routed through Next; backend log `status=400` |
| Provider-approved (`1x0000...AA` + `XXXX.DUMMY.TOKEN.XXXX`) | `200 {"ok":true}` | Routed through Next; backend log shows the real outbound call `POST https://challenges.cloudflare.com/turnstile/v0/siteverify "HTTP/1.1 200 OK"`, `status=200` |
| Provider-rejected (`2x0000...AA` + same test token) | `403 {"ok":false,"error":"Captcha verification failed. Please try again."}` | Routed through Next; backend log shows the real Cloudflare call plus `[captcha] Turnstile verification failed: ['invalid-input-response']`, `status=403` |
| Provider transport/fail-open | Not live-simulated (would require disrupting Cloudflare, explicitly disallowed) | Covered by Checkpoint 18's automated test (`test_verify_captcha.py`) |

**No real user token was used at any point** — only Cloudflare's
officially-documented dummy test credentials, which are explicitly
designed to be public and safe for automated testing on any domain
including `localhost`.

**Security:** same synthetic `Authorization`/`Cookie` headers sent;
confirmed absent from backend logs (grepped, not found). `502`
no-fallback transport-failure policy unchanged — not re-tested live
(would require taking down the real, shared backend, explicitly
disallowed this checkpoint); Checkpoint 18's existing automated test
(`"does NOT fall back to Next on Python transport failure"`) already
covers it and was reconfirmed passing in this checkpoint's full
regression run.

**Rollback:** removed `BACKEND_ROUTE_VERIFY_CAPTCHA` from the local shell
env, restarted Next, confirmed `backend: 'next', fallback: false` and a
correct `200 {"ok":true}` response (matching the local missing-secret
default, since `.env.local` also has no `TURNSTILE_SECRET_KEY`).

## Observability

For every routed request, both sides produced correlated, timestamped
evidence:

- **Next side:** `[backend-routing] Routing endpoint { endpoint, backend, fallback }`
- **Backend side (`vercel logs`):** `request method=... path=... status=... request_id=<hex> duration_ms=...`, plus geo's/captcha's own domain-specific log lines (`[geo] Location result via Vercel header: IN`, `[captcha] Turnstile verification failed: [...]`, the real outbound Cloudflare HTTP request line).

No `Authorization`, `Cookie`, secret value, or environment dump appeared
in any log inspected this checkpoint.

## Narrow Fix Applied

See `MIGRATION_DECISIONS.md` for the full record. Summary:
`src/lib/backend-routing.ts` gained `applyDeploymentProtectionBypass()`,
called from both `geo/route.ts` and `verify-captcha/route.ts`'s header
builders. It attaches Vercel's own documented
`x-vercel-protection-bypass` header only when `PYTHON_BACKEND_BYPASS_SECRET`
is explicitly set — a no-op otherwise, so production behavior (where the
backend will eventually be promoted out of Preview and this becomes
unnecessary) is unaffected. Covered by 4 new tests (2 in
`backend-routing.test.ts`, 1 each in `geo/route.test.ts` and
`verify-captcha/route.test.ts`).

## Environment Cleanup Performed

- `project-scquo`: `PYTHON_BACKEND_URL`, `BACKEND_ROUTE_GEO`,
  `BACKEND_ROUTE_VERIFY_CAPTCHA`, `PYTHON_BACKEND_BYPASS_SECRET` — all
  removed from Preview scope (never consumed by any successful
  deployment, so nothing to roll back functionally; removed to avoid
  leaving unused routing config sitting on the real frontend project).
- `layah-backend-python`: `TURNSTILE_SECRET_KEY` removed, one final
  redeploy performed to restore the zero-secret default state.
- Local shell environment variables: process-scoped only, gone once
  their `npm run dev` process was stopped; never written to `.env.local`
  or any file.

## Human Action Required

1. **`project-scquo` Root Directory setting.** Currently `.`, which the
   current Vercel CLI/API rejects for `vercel deploy` (non-git-integration)
   deploys. A human with project-settings access should either clear it
   to the empty/default value in the Vercel dashboard (Project Settings →
   General → Root Directory), or confirm this project is meant to deploy
   only via GitHub integration (in which case CLI-based Preview deploys
   of this project will keep failing, which is fine if intentional but
   should be a conscious choice, not a discovered accident).
2. Once resolved, an actual Next **Preview** deployment (not just local
   dev) should repeat this checkpoint's routing test to close the gap
   between "proven against local dev" and "proven against an actual
   Vercel Preview" — the code is identical either way, but this
   checkpoint's own rigor standard says not to claim the untested case as
   proven.

## Final State (as of Checkpoint 20)

- `GET /api/geo` → **NEXT** (rollback confirmed)
- `POST /api/auth/verify-captcha` → **NEXT** (rollback confirmed)
- No `PYTHON_BACKEND_URL`/`BACKEND_ROUTE_*` persisted anywhere
- Backend: zero-secret default state restored
- `project-scquo`: unmodified

## Checkpoint 21: Preview-to-Preview Closure

The gap flagged above — "proven against local dev" vs. "proven against an
actual Vercel Preview" — is now closed. **DIRECT REMOTE VERIFIED**,
**NEXT PREVIEW → PYTHON PREVIEW VERIFIED**, **PROVIDER PATH VERIFIED**,
and **ROLLBACK VERIFIED** are all now true for both endpoints, using a
real `project-scquo` Preview deployment, not local development.

### Root Directory Fix

**CURRENT ROOT DIRECTORY:** `.` (both `project-scquo`'s server-side
project setting and, separately, the local `.vercel/repo.json` link
file's per-project `directory` field — two distinct places carrying the
same broken value).
**EXPECTED:** empty/unset (Vercel's convention for "deploy from repo
root"), matching where `package.json`/`next.config.ts`/`vercel.json`
actually live.
**EVIDENCE:** confirmed via repo layout inspection before touching
anything.

**Fix applied, smallest possible in each place:**

1. Server-side: `vercel project update project-scquo --auto-detect
   root-directory` — resets to Vercel's own automatic detection rather
   than a guessed value. Confirmed via the command's own output
   (`Root Directory: Auto`).
2. Local: `.vercel/repo.json` had `"directory": "."` for the
   `project-scquo` entry. This file is gitignored, local-machine-only
   link metadata — not a repository file, not a server setting. Testing
   confirmed this field feeds directly into the deploy API's
   `rootDirectory` payload: setting it to `""` produced a *different*
   error (`should NOT be shorter than 1 characters`), proving the field
   must be either a valid non-empty path or **omitted entirely**. Removed
   the `directory` key from the entry.

Both fixes together produced a working deploy: `vercel deploy --yes`
succeeded on the first attempt afterward and on every subsequent redeploy
this checkpoint (5 more, for iterating through the routing/Turnstile test
matrix).

**Post-change verification:** `project-scquo`'s project ID
(`prj_evS8AChRJBl5N7nY7ZO5ItrBLhg1`), name, framework preset ("Next.js"),
and production URL (`https://www.layah.in`) were all confirmed unchanged
via `vercel project ls`/`vercel project inspect`, before and after.
`layah-backend-python` was never touched by this fix. No custom domain
was added or changed.

### Real Next Preview

Multiple genuine Preview deployments were created from the current
working tree on `phase-1-boundary-stabilization` (iterating to swap
Turnstile test keys required re-pointing `PYTHON_BACKEND_URL`, which
requires a fresh Next build to take effect — env var changes are not
retroactive on already-built deployments). All were `target: null`
(Preview, never Production) and `readyState: READY`. None were promoted.

### Geo — Preview → Preview

| Check | Result |
| --- | --- |
| Routed request | `200 {"country_code":"US","country_name":"US"}` (value varies by Vercel's real edge-detected geolocation for the request's actual source — expected, not a contract issue; shape/type match exactly) |
| Routing proof | Backend's own `vercel logs`: `GET /api/geo status=200 request_id=<hex> duration_ms=0.6–4.6`, timestamp-correlated to each client request, on a freshly-created Preview URL with no other traffic. **Limitation:** Next's own `console.log` routing-decision line was not retrievable via `vercel logs` for `project-scquo` — every query returned only a bodyless `source: "serverless-middleware"` summary entry (`"logs": []`), a genuine observability gap in this project's log capture, not a routing failure. Routing correctness rests on: the explicit env var configuration verified present before each deploy, the backend's own matching request log, and the isolated nature of each fresh Preview URL. |
| Security | Synthetic `Authorization`/`Cookie` sent; confirmed absent from backend logs |
| Latency | Direct backend: ~380–670ms. Routed Preview→Preview: ~600ms–1.05s. The added ~200–400ms reflects a real cross-project Vercel-to-Vercel network hop — not severe, no optimization performed. |
| Rollback | `BACKEND_ROUTE_GEO` removed from Preview scope, Preview redeployed, confirmed `200 {"country_code":"IN","country_name":"IN"}` (Next's own default path) with **zero** matching entries in backend logs for the same window |

### Verify-Captcha — Preview → Preview

Full requested matrix, all through the actual redeployed Next Preview
(not direct backend calls), using Cloudflare's official public test
credentials across two backend secret configurations (each requiring one
backend + one Next redeploy to propagate):

| Case | Result | Backend log evidence |
| --- | --- | --- |
| Invalid JSON | `400 {"ok":false,"error":"Invalid request."}` | `status=400`, matching timestamp |
| Missing token | `400 {"ok":false,"error":"Missing captcha token."}` | `status=400`, matching timestamp |
| Rejected test token (`2x0000...AA`) | `403 {"ok":false,"error":"Captcha verification failed. Please try again."}` | Real outbound `POST .../siteverify "HTTP/1.1 200 OK"`, `[captcha] Turnstile verification failed: ['invalid-input-response']`, `status=403` |
| Approved test token (`1x0000...AA`) | `200 {"ok":true}` | Real outbound `POST .../siteverify "HTTP/1.1 200 OK"`, `status=200` |

No real user token was used at any point — only Cloudflare's officially
public dummy credentials. Synthetic `Authorization`/`Cookie` sent on the
rejected-token request; confirmed absent from backend logs. `502`
no-fallback transport-failure policy unchanged, not live-simulated
(consistent with Checkpoint 20 — would require disrupting the real
backend).

**Rollback:** `BACKEND_ROUTE_VERIFY_CAPTCHA` removed from Preview scope,
redeployed, confirmed `200 {"ok":true}` (Next's own missing-secret
default — `.env.local` has no `TURNSTILE_SECRET_KEY` either) with zero
matching backend log entries for the same window.

### Cleanup

- `PYTHON_BACKEND_URL`, `BACKEND_ROUTE_GEO`, `BACKEND_ROUTE_VERIFY_CAPTCHA`,
  `PYTHON_BACKEND_BYPASS_SECRET` — all removed from `project-scquo`
  Preview scope, confirmed via `vercel env ls`.
- `TURNSTILE_SECRET_KEY` — removed from `layah-backend-python`, one final
  redeploy performed to restore the zero-secret default, confirmed via a
  direct request showing the missing-secret short-circuit again.
- Local `.vercel/repo.json` fix is **not** reverted — it's a genuine bug
  fix to local machine state (gitignored, not a repository file), not
  temporary test configuration, and reverting it would restore the
  original deploy failure.
- No new secret was created this checkpoint; the existing Checkpoint 20
  bypass secret (never re-displayed) was reused as-is.

### Pilot-Phase Closure

**PILOT_ENDPOINT_MIGRATION_PHASE = COMPLETE.**

`GET /api/geo` and `POST /api/auth/verify-captcha` are both fully
validated end-to-end: contract parity, real remote deployment, real
Next-Preview-to-Python-Preview routing, security isolation, observability,
and configuration-only rollback, including verify-captcha's real
Turnstile provider branch (both outcomes). Both remain on `NEXT` by
deliberate choice — Production activation is a separate, not-yet-made
decision, not a validation gap.

**NEXT MIGRATION MODE = BATCH / SUBSYSTEM WAVES.** Per the user's explicit
direction, the migration unit changes from "one endpoint per checkpoint"
to subsystem/batch migration waves for the remaining ~80 Next API routes.
See `MIGRATION_MASTER_PLAN.md` for the phase structure this maps onto.
