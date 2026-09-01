# Backend Migration Manifest

Date: 2026-09-01

Status legend:

- `NEXT_ONLY`
- `PYTHON_PARITY`
- `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`
- `PYTHON_CUTOVER_CANDIDATE`
- `BLOCKED`
- `FUTURE_AI_SERVICE`
- `KEEP_FRONTEND_SIDE`
- `UNKNOWN`

## Current Classifications

| Area | Status | Routing infrastructure | Cutover | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/geo` | `CUTOVER_VALIDATED` | ready for explicit opt-in via `BACKEND_ROUTE_GEO=python` | not cut over (no deployed FastAPI target exists) | low-risk Track B pilot; Checkpoint 15 proved routing/security/rollback live against a local FastAPI instance; default remains Next until a real deployment target exists |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER` | not enabled for routing | not cut over | authenticated unit-contract parity proved; local verification blocked by Supabase runtime/schema/RLS issues |
| `POST /api/lesson-plan` | `FUTURE_AI_SERVICE` | none | not cut over | generation remains Next-owned for now |
| `POST /api/question-paper` | `FUTURE_AI_SERVICE` | none | not cut over | AI and quota heavy |
| `POST /api/question-paper/blueprint` | `FUTURE_AI_SERVICE` | none | not cut over | AI heavy |
| `POST /api/differentiated-pack` | `FUTURE_AI_SERVICE` | none | not cut over | AI and quota heavy |
| `POST /api/razorpay/webhook` | `NEXT_ONLY` | none | not cut over | money-impacting, not a parity pilot |
| `POST /api/razorpay/*` admin/user flows | `NEXT_ONLY` | none | not cut over | billing remains in Next for now |
| `/api/school-admin/*`, `/api/super-admin/*`, `/api/hod/me` | `NEXT_ONLY` | none | not cut over | high-risk authorization/tenant flows |
| `POST /api/lesson-plan/export/*`, `POST /api/question-paper/export/*`, `POST /api/differentiated-pack/export-*` | `PYTHON_PARITY` | none | not cut over | document/export seams are future backend candidates |
| `POST /api/contact`, `POST /api/feedback`, `POST /api/waitlist` | `PYTHON_PARITY` | none | not cut over | low-risk public form handlers |
| `GET /api/account/export` | `PYTHON_PARITY` | none | not cut over | read-only user export path |
| `DELETE /api/account/delete` | `BLOCKED` | none | not cut over | destructive user deletion needs more readiness |

## Pilot Notes

- Geo remains the only cutover candidate; no production routing moved.
- Checkpoint 14 adds explicit geo-only routing infrastructure. Python routing still requires server-side opt-in; default configuration stays on Next.
- Checkpoint 15 proved the routing seam live (local Next + local FastAPI): direct Python health/readiness/geo, semantic contract parity, dual-sided routing evidence, Authorization/Cookie exclusion, transport-failure fallback, and rollback all passed. Classification: `VALIDATED_BUT_LEFT_ON_NEXT` — no deployed FastAPI target exists yet, so nothing was left cut over. See `GEO_PYTHON_CUTOVER.md`.
- Checkpoint 16 built repository-side deployment readiness for `backend-python` (Render Blueprint, request-ID/logging middleware, CI job) but had no hosting account access, so no real deployment was created. Classification: `DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED`. Geo status stays `CUTOVER_VALIDATED`; still not cut over. See `FASTAPI_DEPLOYMENT_DECISION.md` and `FASTAPI_DEPLOYMENT_RUNBOOK.md`.
- `lesson-plan/save` is a no-cutover authenticated parity implementation with unit-contract evidence, a guarded integration harness, and static SQL invariant coverage. Checkpoint 12 did not promote it because live RLS verification still needs a reproducible Supabase environment.
- Checkpoint 13 keeps `lesson-plan/save` at `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`. Schema reconciliation planning narrows the blocker but does not remove the need for live RLS verification.
- No repository split happened yet.
