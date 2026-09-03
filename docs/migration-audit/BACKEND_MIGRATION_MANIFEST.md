# Backend Migration Manifest

Date: 2026-09-01

Status legend:

- `NEXT_ONLY`
- `PYTHON_PARITY`
- `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`
- `PYTHON_CUTOVER_CANDIDATE`
- `ROUTING_READY` (Python parity proved + disabled-by-default routing seam wired; still not cut over — no deployed FastAPI target exists)
- `BLOCKED`
- `FUTURE_AI_SERVICE`
- `KEEP_FRONTEND_SIDE`
- `UNKNOWN`

## Current Classifications

| Area | Status | Routing infrastructure | Cutover | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/geo` | `PILOT_VALIDATED_COMPLETE` (real Next Preview → real backend Preview) | ready for explicit opt-in via `BACKEND_ROUTE_GEO=python`; routing mechanism fully proven Preview-to-Preview | not cut over (Production activation is a separate, not-yet-made decision) | low-risk Track B pilot; Checkpoint 15 local, Checkpoint 19 direct-remote, Checkpoint 20 local-dev routing, Checkpoint 21 real Preview-to-Preview closure — see `REMOTE_ROUTING_VALIDATION.md`; `PYTHON_BACKEND_URL`/`BACKEND_ROUTE_GEO` still unset everywhere |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER` | not enabled for routing | not cut over | authenticated unit-contract parity proved; Checkpoint 23 made `lesson_plans` reproducible from a fresh migration for the first time (`20260101000000_lesson_plans_baseline_reconciliation.sql`) and documented+tested the zero-row-update false-positive-success behavior, but live RLS verification remains blocked — no Docker/Supabase CLI and no positively-classified non-production Supabase target exist; see `AUTHENTICATED_BACKEND_PATTERN.md` |
| `POST /api/lesson-plan` | `FUTURE_AI_SERVICE` | none | not cut over | generation remains Next-owned for now |
| `POST /api/question-paper` | `FUTURE_AI_SERVICE` | none | not cut over | AI and quota heavy |
| `POST /api/question-paper/blueprint` | `FUTURE_AI_SERVICE` | none | not cut over | AI heavy |
| `POST /api/differentiated-pack` | `FUTURE_AI_SERVICE` | none | not cut over | AI and quota heavy |
| `POST /api/razorpay/webhook` | `NEXT_ONLY` | none | not cut over | money-impacting, not a parity pilot |
| `POST /api/razorpay/*` admin/user flows | `NEXT_ONLY` | none | not cut over | billing remains in Next for now |
| `/api/school-admin/*`, `/api/super-admin/*`, `/api/hod/me` | `NEXT_ONLY` | none | not cut over | high-risk authorization/tenant flows |
| `POST /api/lesson-plan/export/*`, `POST /api/question-paper/export/*`, `POST /api/differentiated-pack/export-*` | `PYTHON_PARITY` | none | not cut over | document/export seams are future backend candidates |
| `POST /api/auth/verify-captcha` | `PILOT_VALIDATED_COMPLETE` (real Next Preview → real backend Preview) | disabled-by-default opt-in via `BACKEND_ROUTE_VERIFY_CAPTCHA=python`; routing and real Turnstile provider path (both approve/reject) fully proven Preview-to-Preview | not cut over (Production activation is a separate, not-yet-made decision) | Checkpoint 18 second Track B pilot; public, non-mutating, single external call (Cloudflare Turnstile); Python transport failure deliberately does NOT fall back to Next (single-use token risk); Checkpoint 21 exercised the full safe test matrix through a real Next Preview → real backend Preview — see `REMOTE_ROUTING_VALIDATION.md`, `VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md` |
| `POST /api/contact` | `PYTHON_PARITY` (not attempted) | none | not cut over | public form handler; sends a real email via SMTP — Checkpoint 18 shortlist review found no Supabase dependency but a real external side effect and an SMTP secret, so it was not selected as the second pilot |
| `POST /api/feedback`, `POST /api/waitlist`, `POST /api/school-register` | `NEXT_ONLY` (re-classified, Checkpoint 18) | none | not cut over | Checkpoint 18 source review found these perform a **privileged Supabase service-role insert** of real user data (`waitlist`/`feedback` tables), and feedback/school-register also send SMTP email — this was undersold by the prior "low-risk public form handler" label; re-classified out of `PYTHON_PARITY` until a mutation-safe migration pattern (like `lesson-plan/save`'s caller-context approach) is designed for them |
| `GET /api/account/export` | `PYTHON_PARITY` | none | not cut over | read-only user export path |
| `DELETE /api/account/delete` | `BLOCKED` | none | not cut over | destructive user deletion needs more readiness |

## Pilot Notes

- Geo remains the only cutover candidate; no production routing moved.
- Checkpoint 14 adds explicit geo-only routing infrastructure. Python routing still requires server-side opt-in; default configuration stays on Next.
- Checkpoint 15 proved the routing seam live (local Next + local FastAPI): direct Python health/readiness/geo, semantic contract parity, dual-sided routing evidence, Authorization/Cookie exclusion, transport-failure fallback, and rollback all passed. Classification: `VALIDATED_BUT_LEFT_ON_NEXT` — no deployed FastAPI target exists yet, so nothing was left cut over. See `GEO_PYTHON_CUTOVER.md`.
- Checkpoint 16 built repository-side deployment readiness for `backend-python` (Render Blueprint, request-ID/logging middleware, CI job) but had no hosting account access, so no real deployment was created. Classification: `DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED`. Geo status stays `CUTOVER_VALIDATED`; still not cut over. See `FASTAPI_DEPLOYMENT_DECISION.md` and `FASTAPI_DEPLOYMENT_RUNBOOK.md`.
- Checkpoint 17 attempted to provision a real remote FastAPI deployment and run remote verification. Same account-access gap confirmed (no Render/Railway/Vercel CLI, MCP tool, or credential in this session). No repository change was required. Classification: `EXTERNAL_PROVISIONING_BLOCKED`. Geo status unchanged: `CUTOVER_VALIDATED`, not cut over.
- Checkpoint 18 selected `POST /api/auth/verify-captcha` as the second Track B pilot (from a 5-candidate shortlist; contact/feedback/waitlist/school-register were all rejected — see the row notes above and `VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md`). Froze its contract, implemented Python parity with a shared fixture consumed by both Node and Python tests, and added a disabled-by-default routing seam generalized from the geo pattern (`src/lib/backend-routing.ts` now allowlists two endpoints by a fixed map, not a dynamic gateway). Unlike geo, Python transport failure does not fall back to Next, because Turnstile tokens are single-use and a blind retry could falsely reject an already-valid completion. Classification: `SECOND_ENDPOINT_ROUTING_READY`. Status: `ROUTING_READY`, not cut over — `BACKEND_ROUTE_VERIFY_CAPTCHA` was never persisted anywhere, same as `BACKEND_ROUTE_GEO`.
- Checkpoint 19 provisioned the first real remote FastAPI target — on Vercel (project `teacher-app/layah-backend-python`, Preview environment), not Render, after Render/Railway remained completely unavailable and the user explicitly authorized provisioning under the teammate's personal Vercel account. Verified health/readiness/geo remotely with matching contract and clean logs; verify-captcha's contract paths (not its Turnstile provider path — no secret configured) verified remotely too. `PYTHON_BACKEND_URL`/`BACKEND_ROUTE_GEO`/`BACKEND_ROUTE_VERIFY_CAPTCHA` remain unset on Next — no routing enabled. Classification: `REMOTE_FASTAPI_PROVISIONED`. See `FASTAPI_REMOTE_DEPLOYMENT.md`.
- Checkpoint 20 proved the full remote routing path for both endpoints, including verify-captcha's real Turnstile provider branch (approve and reject, using Cloudflare's official public test credentials — no real user token used), header isolation, dual-sided log correlation, and configuration-only rollback. An actual `project-scquo` Preview deployment could not be created (pre-existing Root Directory setting the current Vercel CLI/API rejects — not introduced by, and not fixed by, this checkpoint, since fixing it means modifying `project-scquo`); routing was instead proven via local Next development against the real deployed backend, using the identical production routing code. A Vercel "Protection Bypass for Automation" secret was briefly exposed in tool output during investigation and immediately rotated with the user's explicit authorization — old value revoked, new value never displayed, functional correctness confirmed indirectly via successful routed requests. All temporary Preview/test configuration was removed afterward; the backend rests at its zero-secret default again. Classification: `BOTH_ROUTES_REMOTE_VALIDATED` (with the local-Next-dev caveat documented prominently). See `REMOTE_ROUTING_VALIDATION.md`.
- Checkpoint 21 closed the remaining gap: fixed `project-scquo`'s Root Directory setting (broken in two places — the server-side project setting and, separately, the local gitignored `.vercel/repo.json` link file — both corrected minimally: `--auto-detect root-directory` and removing the local override), produced real Next Preview deployments, and re-ran the full geo + verify-captcha matrix through actual Preview-to-Preview routing, including verify-captcha's real Turnstile provider branch. All checks passed; rollback confirmed for both. `project-scquo` identity, framework, and production domain confirmed unchanged throughout. Classification: `PREVIEW_TO_PREVIEW_VALIDATED_PILOT_COMPLETE`. **PILOT_ENDPOINT_MIGRATION_PHASE = COMPLETE. NEXT MIGRATION MODE = BATCH / SUBSYSTEM WAVES.** See `REMOTE_ROUTING_VALIDATION.md`.
- `lesson-plan/save` is a no-cutover authenticated parity implementation with unit-contract evidence, a guarded integration harness, and static SQL invariant coverage. Checkpoint 12 did not promote it because live RLS verification still needs a reproducible Supabase environment.
- Checkpoint 13 keeps `lesson-plan/save` at `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`. Schema reconciliation planning narrows the blocker but does not remove the need for live RLS verification.
- Checkpoint 22 investigated all remaining ~84 Next API operations for a "Wave 1" bulk migration cohort, using the existing audit plus spot-checked source for every ambiguous case (`hod/me`, `user-usage`, `account/export`, `cron/subscription-maintenance`, `welcome-email`, `auth/school-enrollment`). **Zero additional operations qualify** — every remaining route requires at least one of Supabase (read or write), auth/session, an AI provider, billing, admin authorization, export/file complexity, or SMTP. No route beyond the two already-migrated pilots is unauthenticated, Supabase-free, and AI-free. Classification: `NO_SAFE_WAVE_1_COHORT`. No code changed. Full investigation and refined wave map: `BACKEND_WAVE_1_INVESTIGATION.md`.
- Checkpoint 23 investigated the authenticated Supabase/RLS foundation blocking Wave 2. Re-confirmed no safe mutation target exists (no Docker/Supabase CLI; the only hosted project remains `UNKNOWN`) — unchanged from Checkpoints 9–13, so no live RLS/auth verification was possible. Made concrete, safe repository-side progress instead: wrote and statically tested a `lesson_plans` baseline reconciliation migration (existence-guarded, no-op on any database where the table already exists), resolved and documented the previously-open zero-row-update semantics question (existing Next behavior confirmed and now regression-tested in both implementations), confirmed the existing auth (`authenticate_request`) and persistence (`SupabaseRestClient`) code is already appropriately reusable with no changes needed, and confirmed the existing guarded RLS integration harness is complete with no gaps. Classification: `AUTHENTICATED_DB_FOUNDATION_PARTIAL`. See `AUTHENTICATED_BACKEND_PATTERN.md` for the full reusable pattern and exact remaining external prerequisites.
- No repository split happened yet.

## Checkpoint 24 Authenticated DB Foundation Re-Check

Supabase CLI is now installed as a project dev dependency and verified with `npx supabase --version` = `2.116.0`. `npm run test:rls` names the existing guarded integration harness so future local verification has a single project command.

Live authenticated database proof is still externally blocked because Docker/Podman is not installed or available on PATH. `npx supabase start` fails before any local database can start, and `npx supabase db reset` therefore cannot reach Postgres. No hosted Supabase project was contacted or mutated.

Current classification: `AUTHENTICATED_DB_FOUNDATION_EXTERNALLY_BLOCKED`.

`POST /api/lesson-plan/save` remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`: Python/Next parity and the caller-context architecture are repository-proven, but frontend -> Python backend -> Supabase Auth -> PostgREST -> RLS -> persistence is not live-proven until Docker Desktop is installed/running and `npm run test:rls` passes against `LOCAL_DISPOSABLE` Supabase.

## Checkpoint 25 Authenticated DB Foundation Verified

Docker Desktop is installed and running through the WSL2 backend. Local
Supabase starts, fresh `db reset` succeeds, and `npm run test:rls`
passes against `LOCAL_DISPOSABLE`.

`POST /api/lesson-plan/save` can now be treated as authenticated
caller-context persistence proof for the physical backend split:
`PYTHON_PARITY_WITH_LIVE_RLS_VERIFICATION`. It is still not cut over to
production traffic.
