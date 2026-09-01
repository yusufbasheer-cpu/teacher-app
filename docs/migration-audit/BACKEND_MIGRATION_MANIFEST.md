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

| Area | Status | Notes |
| --- | --- | --- |
| `GET /api/geo` | `PYTHON_CUTOVER_CANDIDATE` | low-risk pilot; parity proved in Python foundation |
| `POST /api/lesson-plan/save` | `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER` | authenticated unit-contract parity proved; guarded RLS integration harness added; local verification is blocked by missing Supabase runtime tooling and `lesson_plans` schema-source drift |
| `POST /api/lesson-plan` | `FUTURE_AI_SERVICE` | generation remains Next-owned for now |
| `POST /api/question-paper` | `FUTURE_AI_SERVICE` | AI and quota heavy |
| `POST /api/question-paper/blueprint` | `FUTURE_AI_SERVICE` | AI heavy |
| `POST /api/differentiated-pack` | `FUTURE_AI_SERVICE` | AI heavy |
| `POST /api/razorpay/webhook` | `NEXT_ONLY` | money-impacting, not a parity pilot |
| `POST /api/razorpay/*` admin/user flows | `NEXT_ONLY` | billing remains in Next for now |
| `/api/school-admin/*`, `/api/super-admin/*`, `/api/hod/me` | `NEXT_ONLY` | high-risk authorization/tenant flows |
| `POST /api/lesson-plan/export/*`, `POST /api/question-paper/export/*`, `POST /api/differentiated-pack/export-*` | `PYTHON_PARITY` | document/export seams are future backend candidates |
| `POST /api/contact`, `POST /api/feedback`, `POST /api/waitlist` | `PYTHON_PARITY` | low-risk public form handlers |
| `GET /api/account/export` | `PYTHON_PARITY` | read-only user export path |
| `DELETE /api/account/delete` | `BLOCKED` | destructive user deletion needs more readiness |

## Pilot Notes

- Geo remains the only cutover candidate; no production routing moved.
- `lesson-plan/save` is a no-cutover authenticated parity implementation with unit-contract evidence and a guarded integration harness. Checkpoint 11 attempted local enablement but stopped because the local runtime prerequisites are absent and the migration chain cannot fresh-create `lesson_plans`.
- No repository split happened yet.
