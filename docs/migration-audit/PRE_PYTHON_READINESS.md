# Pre-Python Readiness

Date: 2026-08-31

This captures the checkpoint-7 readiness pass before the Python backend foundation was created.

## BLOCKS PYTHON SKELETON

None found in the current audit trail.

## DOES NOT BLOCK PYTHON SKELETON

- `GET /api/geo` is a low-risk pilot with no auth, quota, billing, AI, streaming, or persistence side effects.
- The backend already has a clear service seam for geo lookup in `src/lib/geo-service.ts`.
- The existing Next route tests already isolate the route from the service.
- The repo already contains a separate `python-ppt-api/` service, so a new isolated backend directory is structurally consistent.
- Python 3.12.10 is available locally.

## Ranked Pilot Candidates

1. `GET /api/geo`
2. `POST /api/waitlist`
3. `POST /api/contact`
4. `POST /api/feedback`
5. `GET /api/account/export` read path

## Recommended Pilot 1

`GET /api/geo`

Reason:

- already has a dedicated service module
- already has a route wrapper
- simple request/response contract
- easy to run without auth or persistence
- fallback behavior is deterministic and testable

## Follow-Up Notes

- Lesson generation, billing, admin/school flows, and authenticated writes remain out of scope for the skeleton pilot.
- This readiness pass does not change production routing.

## Authenticated Python RLS Integration

Status: `NO`

Checkpoint 9 added a guarded integration harness for `POST /api/lesson-plan/save`, but did not run it because no Supabase target could be classified as local, dedicated test, or controlled staging. The current `.env.local` project is unmarked and therefore unsafe for mutation tests.

Checkpoint 10 repeated the classification and found the same blocker. The `.env.local` project ref `jbwevzvtloahjoamwnjt` is still `UNKNOWN`, not mutation-safe.

Checkpoint 11 found that local Supabase is not yet reproducible because the CLI/runtime are absent and the migration chain does not create `public.lesson_plans`.

Required before cutover candidacy:

- local Supabase runtime with Auth/PostgREST/RLS, or
- dedicated test Supabase project, or
- explicitly controlled staging Supabase project

The environment must set explicit integration variables and mutation approval flags documented in `FASTAPI_RLS_INTEGRATION.md`.
