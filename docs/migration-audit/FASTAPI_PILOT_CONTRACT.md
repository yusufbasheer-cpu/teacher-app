# FastAPI Pilot Contract

Date: 2026-09-01

## `POST /api/lesson-plan/save`

| Concern | Next.js reference | FastAPI parity pilot |
| --- | --- | --- |
| Auth input | SSR Supabase client reads same-origin cookies; browser caller also sends bearer token | `Authorization: Bearer` token validated by Supabase Auth |
| Identity | `supabase.auth.getUser()` result | `/auth/v1/user` result; request `user_id` is not accepted as authority |
| Request parsing | `req.json()` then predicate | JSON parse plus Pydantic model, adapted to return `400` |
| Invalid JSON/payload | `400 {"error":"Invalid request."}` | Same |
| Missing identity | `401 {"error":"Unauthorized"}` | Same |
| Auth lookup failure | `500 {"error":"Something went wrong. Please try again."}` | Same generic body |
| Insert | `lesson_plans.insert(payload).select("id").single()` | PostgREST `POST` with `select=id`, `return=representation` |
| Update | `update(payload).eq("id", id).eq("user_id", userId)` | PostgREST `PATCH` with equivalent filters and `return=minimal` |
| Insert success | `201 {action:"inserted",id}` | Same |
| Update success | `200 {action:"updated",id}` | Same |
| Persistence failure | `500` generic error body | Same |

## Payload

Both implementations write `user_id`, `curriculum_type`, normalized `curriculum_framework`, `subject`, `grade`, trimmed `chapter`, trimmed `topic`, `learning_objectives`, and merged `lesson_plan` metadata. The Python model ignores unknown top-level/form fields as the TypeScript predicate does and keeps the same supported curriculum, grade, subject, and framework values.

## Known Observable Difference

The current Next route authenticates its SSR client from cookies, while the Python pilot authenticates the bearer token explicitly. The browser already sends that bearer token through the shared API client, so no frontend change is required. Cookie-only requests are not a supported Python pilot input. This difference must be covered before cutover.

## Fixtures

Synthetic request and response fixtures live under `contract-fixtures/lesson-plan-save/`. They contain no real identities, content, tokens, or secrets.

## Existing Geo Pilot

`GET /api/geo` remains the read-only FastAPI foundation pilot. Its contract is unchanged: response keys are `country_code` and `country_name`, provider ordering is Vercel header, `ipapi.co`, `api.country.is`, then UAE fallback; each provider call uses the existing four-second timeout, and production traffic remains on Next.
