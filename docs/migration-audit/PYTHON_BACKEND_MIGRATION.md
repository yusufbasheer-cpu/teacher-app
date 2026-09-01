# Python Backend Migration

## Current Backend Architecture

The backend is mostly Next.js route handlers in `src/app/api`, with business modules in `src/lib`. It directly handles Supabase Auth verification, RLS-scoped user clients, service-role admin operations, DeepSeek/fal/Pexels calls, Razorpay billing, SMTP mail, document export, file extraction, cron, and webhooks.

There is already a separate Python Flask service in `python-ppt-api`, but it is limited to PPT template generation and is not the main backend.

## Proposed Python Stack

- FastAPI for HTTP APIs, async endpoints, streaming responses, generated OpenAPI.
- Pydantic for request/response schemas.
- SQLAlchemy or SQLModel only where direct Postgres access is needed; continue Supabase RPC/PostgREST during transition if it reduces risk.
- Alembic for migrations once backend owns schema migrations; initially keep existing Supabase migrations intact.
- HTTPX for DeepSeek, Turnstile, Pexels, internal AI service calls.
- Razorpay Python SDK or signed HTTP calls for billing.
- Background jobs: start without Celery/RQ because no durable queue exists today; add Celery/RQ/Dramatiq plus Redis only when replacing long-running cron/email/AI processing.
- Auth: verify Supabase JWTs and preserve user ID/claims. Service role remains server-only.

Checkpoint 8 implements the first authenticated parity endpoint with a smaller, configuration-compatible strategy: Supabase Auth validates the bearer token through `/auth/v1/user`, then the same token is forwarded to PostgREST. Local JWT/JWKS verification is deferred until the project's signing configuration and issuer/audience contract are explicitly established.

Checkpoint 9 adds a guarded real-RLS integration harness for `POST /api/lesson-plan/save`, but the real run is blocked until a non-production Supabase environment is explicitly identified. The endpoint remains `PYTHON_PARITY`, not a cutover candidate.

## Endpoint Migration Map

| Existing area | Python target | Compatibility requirement |
| --- | --- | --- |
| Auth/captcha/welcome/school-enrollment | FastAPI auth module | Preserve bearer-token and cookie expectations or provide frontend API wrapper. |
| Usage/quota | FastAPI usage module calling same Supabase RPCs | Preserve atomic reserve/refund and error codes. |
| Lesson generation | Backend facade + AI service | Preserve `/api/lesson-plan` JSON/NDJSON response contract. |
| Question/differentiated generation | Backend facade + AI service | Preserve Pro lock errors, parse notices, usage payloads. |
| Exports/extraction | FastAPI document module | Preserve MIME types, filenames, upload limits, auth. |
| Billing/webhooks | FastAPI billing module | Preserve Razorpay HMAC validation and local state transitions. |
| School/HOD/admin | FastAPI admin/tenant modules | Preserve role checks and response shapes. |
| Cron | FastAPI scheduled endpoint or platform scheduler | Add explicit cron secret gate before public exposure. |
| Python PPT API | Merge or keep as document subservice | If merged, preserve `/health` and `/generate-ppt` until callers migrate. |

## Migration Sequence

1. Freeze and document current API contracts with tests.
2. Create typed frontend API client and route all frontend fetches through it.
3. Add OpenAPI/Pydantic schemas matching existing JSON.
4. Extract AI provider/orchestration behind backend-owned interface.
5. Stand up FastAPI backend with read-only/auth/usage endpoints first.
6. Migrate low-risk public APIs (`geo`, `contact`, `waitlist`) behind proxy.
7. Use the proven `lesson-plan/save` pattern as the template for authenticated persistence endpoints that must keep caller-context Supabase or equivalent ownership checks.
8. Migrate exports/extraction.
9. Migrate admin/school APIs.
10. Migrate billing/webhooks with replay tests.
11. Migrate generation endpoints last, with parity snapshots and canary traffic.

## Key Risks

- API-compatible streaming from `/api/lesson-plan`.
- Supabase cookies/JWT and RLS behavior.
- Razorpay webhook idempotency and status transitions.
- Usage quota reservation/refund under concurrency.
- Client-side direct Supabase writes for saved lessons.
- No currently runnable local Supabase stack or marked test/staging Supabase project exists for authenticated RLS integration verification.
