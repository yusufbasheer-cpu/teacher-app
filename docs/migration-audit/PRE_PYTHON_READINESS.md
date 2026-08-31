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
