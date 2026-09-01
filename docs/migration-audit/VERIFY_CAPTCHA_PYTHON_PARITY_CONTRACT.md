# `POST /api/auth/verify-captcha` — Python Parity Contract

Date: 2026-09-01 (Checkpoint 18)

## Candidate Shortlist (Work Package B)

Built from `docs/migration-audit/API_INVENTORY.md`'s endpoint-group table
and `BACKEND_MIGRATION_MANIFEST.md`, then verified by reading each route's
actual source (the inventory doc groups several routes together and
undersells some of their dependencies).

| Route | Method | Auth | Database | External provider | Mutation | Secret | Risk | Why / why not |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/auth/verify-captcha` | POST | public | none | Cloudflare Turnstile | none | `TURNSTILE_SECRET_KEY` (optional — endpoint already degrades to a safe default without it) | **LOW** | **Selected.** No Supabase, no SMTP, no mutation. Single bounded external HTTP call, deterministic and mockable. Already has explicit fail-open/fail-closed semantics to preserve exactly. |
| `POST /api/contact` | POST | public | none | none | none (but sends a real email) | `SMTP_*` (required, not optional) | MEDIUM | Rejected: real external side effect (an actual email send) that's expensive/risky to parity-verify without live SMTP, and would require copying SMTP secrets into Python — explicitly discouraged unless a candidate genuinely needs them. |
| `POST /api/feedback` | POST | public | **Supabase (service-role insert)** | none | **yes** | `SUPABASE_SERVICE_ROLE_KEY` + `SMTP_*` | HIGH-MEDIUM | Rejected: privileged Supabase write plus SMTP send — violates both "no Supabase writes" and "no new secret if possible." |
| `POST /api/waitlist` | POST | public | **Supabase (service-role insert)** | none | **yes** | `SUPABASE_SERVICE_ROLE_KEY` | MEDIUM | Rejected: privileged Supabase write of real user data (email). Manifest's earlier "low-risk public form handler" label undersold this — source shows a direct `service_role` insert. |
| `POST /api/school-register` | POST | public | **Supabase (service-role insert)** | none | **yes** | `SUPABASE_SERVICE_ROLE_KEY` + `SMTP_*` | HIGH-MEDIUM | Rejected: same compound risk as feedback, plus a larger request body. |

No endpoint beyond this shortlist was inspected — the rest of
`API_INVENTORY.md`'s 84 operations are authenticated, admin, billing, AI,
export/streaming, or otherwise explicitly excluded by this checkpoint's
scope and were not re-audited.

### Selection Rationale

1. **Why this endpoint?** It's the only public, non-mutating endpoint in
   the shortlist with no Supabase or SMTP dependency at all.
2. **Why is it low risk?** No auth, no persistence, no billing, no AI, no
   streaming, no file generation. One outbound HTTP call to a single
   well-known public endpoint (Cloudflare Turnstile's `siteverify`), with
   an existing bounded timeout (5000ms) and existing explicit
   success/failure/fail-open branches — nothing to invent.
3. **What does it prove beyond geo?** Geo proved a read-only GET with no
   request body and no secret. This proves: parsing/validating a JSON
   POST body under the FastAPI/Pydantic-adjacent stack without
   accidentally changing status codes (FastAPI's automatic body-parsing
   defaults to `422`; this route deliberately does NOT use it, to keep
   the existing `400` contract), and an external call carrying a
   request-scoped secret while the process itself still starts with zero
   required environment variables.
4. **Does it require a new Python dependency?** No — `httpx` (already a
   dependency for geo and lesson-plan) is sufficient.
5. **Does it touch user data?** No persistence at all; the only "user
   data" involved is the ephemeral CAPTCHA token and caller IP, both
   already sent to Turnstile by the existing Next implementation.
6. **Can it be contract-tested without external production systems?**
   Yes — the Turnstile call is fully mockable (`httpx.AsyncClient`
   injection, matching the existing geo test pattern), and no Supabase or
   other production system is involved at all.

## Existing Next Implementation

`src/app/api/auth/verify-captcha/route.ts` (single file, no separate
service — this route's logic lives entirely in the route handler today).

## Frozen Contract

**Route:** `POST /api/auth/verify-captcha`
**Auth:** none (public; used *before* a user is authenticated, to gate
signup/contact-style forms).

**Headers used:**
- `x-forwarded-for` / `x-real-ip` — used only to (a) key the Next-side
  in-memory rate limiter and (b) populate Turnstile's `remoteip` field.
  Not required; falls back to `"unknown"`.

**Request body:** JSON `{ token?: string }`.

**Validation, in this exact order** (order matters — see edge cases
below):

1. If `TURNSTILE_SECRET_KEY` is unset/empty (after trim) → return
   `200 {"ok": true}` **immediately, without parsing the request body at
   all**. Turnstile is never called.
2. Otherwise, parse the JSON body.
   - Malformed JSON → `400 {"ok": false, "error": "Invalid request."}`.
3. Read `token`, trim it.
   - Empty/missing → `400 {"ok": false, "error": "Missing captcha token."}`.
4. Call Turnstile's `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
   with `{secret, response: token, remoteip}`, JSON content type, 5000ms
   bounded timeout.
   - Request throws (network error, timeout) or the response body isn't
     valid JSON → **fail open**: `200 {"ok": true}`. Turnstile's own HTTP
     status code is never checked — only whether a JSON body could be
     parsed from it.
   - Parsed JSON's `success` field is falsy → `403 {"ok": false, "error": "Captcha verification failed. Please try again."}`.
   - `success` is `true` → `200 {"ok": true}`.

**Content type:** `application/json` throughout, all statuses.

**Side effects:** none (no persistence, no email, no state mutation).

**Not part of this contract (deliberately excluded from Python parity):**

- **Rate limiting.** Next's 10-requests/hour-per-IP limiter
  (`src/lib/rate-limit.ts`) is in-memory, process-local, and resets on
  every cold start — the codebase's own comment calls it out as
  best-effort ("swap for Upstash Redis when the payment gateway is
  live"). It is operational abuse protection, not part of the
  success/validation/error contract callers rely on, and reproducing it
  in Python would require picking a new shared store — an unjustified
  new dependency for an endpoint that isn't being routed to Python live.
  Documented here as a known, accepted gap, not a silent omission.

## Known Edge Cases — Explicit Interpretation Decisions

The existing Next code has two edge cases that are **unhandled crashes**
in the current implementation, not designed behavior:

1. If the JSON body parses successfully but `body.token` is a non-string
   value (e.g. a number), Next's `body.token?.trim()` throws a
   `TypeError` **outside** the route's only try/catch, producing Next's
   default unhandled-exception `500` response. This cannot happen via the
   actual caller (`src/components/auth/auth-card.tsx` always sends
   `{ token: turnstileToken }` where `turnstileToken` is a string from the
   Turnstile widget), so it is not part of the endpoint's designed
   contract.
2. If the JSON body parses to `null` (`JSON.parse("null")`), the same
   `body.token` access throws (`Cannot read properties of null`), again
   producing Next's default `500`.

**Decision:** Python does not reproduce these crashes. A non-string or
missing `token` field (including a `null` top-level body) is treated as
"missing token" → the designed `400 {"ok": false, "error": "Missing captcha token."}`
response, not a `500`. This preserves the endpoint's *intended* validation
behavior rather than an accidental crash path that no real caller
triggers. If this decision needs revisiting, it's isolated to
`backend-python/app/api/routes/verify_captcha.py`'s body-parsing branch.

No other status code, field name, casing, nullability, provider ordering,
or default was changed from the existing Next behavior.

## Dependencies / Ownership

- **Next:** `src/app/api/auth/verify-captcha/route.ts` (route + logic,
  single file). Caller: `src/components/auth/auth-card.tsx`.
- **Python:** `backend-python/app/api/routes/verify_captcha.py` (HTTP
  parsing, validation order, status mapping) +
  `backend-python/app/services/verify_captcha.py` (Turnstile call,
  client-IP extraction).
- **Shared fixture:** `contract-fixtures/verify-captcha/verify-captcha-contract.json`,
  consumed by both `backend-python/tests/test_verify_captcha.py` and
  `src/app/api/auth/verify-captcha/route.test.ts`.

## Python Target

New optional `Settings` fields (both default to empty/safe values, so the
process still starts with zero required environment variables):

- `turnstile_secret_key: str = ""` (alias `TURNSTILE_SECRET_KEY`, matching
  the existing Next variable name — no new secret name introduced)
- `turnstile_timeout_seconds: float = 5.0` (matches Next's `AbortSignal.timeout(5000)`)

## Migration Risk

**LOW.** No persistence, no auth, no billing, no AI, fully deterministic
and mockable. The only residual risk is the rate-limiter gap noted above,
which is explicitly out of scope and does not affect correctness.

## Future Routing/Cutover Requirements

Not implemented in this checkpoint — see
`docs/migration-audit/MIGRATION_DECISIONS.md` for whether a
disabled-by-default routing seam was added and why. If added, it must
follow the exact `BACKEND_ROUTE_GEO`-style per-endpoint opt-in pattern
established in `src/lib/backend-routing.ts` — no generic gateway, default
remains Next, no `Authorization`/`Cookie` forwarding (this endpoint never
needed them), no client-visible backend URL.

(A disabled-by-default routing seam, `BACKEND_ROUTE_VERIFY_CAPTCHA`, was
in fact added in Checkpoint 18 — see `BACKEND_ROUTING_AND_ROLLBACK.md`.)

## Checkpoint 19 Addendum

A real remote FastAPI target now exists (Vercel, project
`teacher-app/layah-backend-python` — see `FASTAPI_REMOTE_DEPLOYMENT.md`).
Verified remotely: `POST /api/auth/verify-captcha` with no
`TURNSTILE_SECRET_KEY` configured and a garbage (invalid-JSON) body
still returns `200 {"ok":true}` — confirming the subtlest edge case in
this contract (secret-absent skips body parsing entirely, so even a
malformed body never gets a chance to trigger the `400` path) holds in
the real deployment, not just locally.

**Not verified remotely:** the real Turnstile provider path (success,
rejection, or transport-failure responses from Cloudflare) —
`TURNSTILE_SECRET_KEY` was not configured on the remote deployment, per
this checkpoint's explicit instruction not to expose or copy it without
a safe, authorized source. Status: `REMOTE_PROVIDER_PATH_NOT_EXERCISED`.

Next→remote-Python routing was not enabled — `PYTHON_BACKEND_URL`/
`BACKEND_ROUTE_VERIFY_CAPTCHA` remain unset on Next. Manifest status:
`ROUTING_READY_REMOTE_TARGET_READY`, not `CUTOVER_ACTIVE`.

## Checkpoint 20 Addendum

The Turnstile provider path marked pending above is now resolved.
Cloudflare officially publishes public dummy test credentials safe for
automated testing on any domain (verified against Cloudflare's own
documentation before use). Using them, the backend's
`TURNSTILE_SECRET_KEY` was temporarily set to the "always passes"
(`1x0000000000000000000000000000000AA`) and "always fails"
(`2x0000000000000000000000000000000AA`) test secrets in turn, and the
real Cloudflare `siteverify` endpoint was called for real:

- Approved test token → `200 {"ok":true}`, backend log shows the actual
  outbound `POST .../siteverify "HTTP/1.1 200 OK"`.
- Rejected test token → `403 {"ok":false,"error":"Captcha verification failed. Please try again."}`,
  backend log shows `[captcha] Turnstile verification failed: ['invalid-input-response']`.

Both were exercised **through the actual Next routing path**, not just
direct backend calls — see `REMOTE_ROUTING_VALIDATION.md` for full
dual-sided log evidence. No real user token was used at any point.
`REMOTE_PROVIDER_PATH_NOT_EXERCISED` is superseded:
**provider path now remotely verified** (both branches).

The backend's `TURNSTILE_SECRET_KEY` was removed again afterward,
restoring the zero-secret default state.

Routing itself was validated against local Next **development**, not an
actual Next **Preview** deployment — `project-scquo`'s Vercel Preview
deploys are currently blocked by a pre-existing, out-of-scope Root
Directory setting (see `REMOTE_ROUTING_VALIDATION.md`). Rollback
confirmed via configuration change only. Manifest status:
**REMOTE_ROUTING_AND_PROVIDER_VALIDATED (local Next dev + remote
Preview backend)** — not yet full Preview-to-Preview, not
`CUTOVER_ACTIVE`.
