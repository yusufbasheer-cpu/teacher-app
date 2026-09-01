# Python Backend Migration

## Current Backend Architecture

The backend is mostly Next.js route handlers in `src/app/api`, with business modules in `src/lib`. It directly handles Supabase Auth verification, RLS-scoped user clients, service-role admin operations, DeepSeek/fal/Pexels calls, Razorpay billing, SMTP mail, document export, file extraction, cron, and webhooks.

There is already a separate Python Flask service in `python-ppt-api`, but it is limited to PPT template generation and is not the main backend.

Python backend migration does not imply database schema migration. Database changes remain governed by the canonical Supabase/Postgres source of truth documented in `DATABASE_SOURCE_OF_TRUTH.md`.

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

Checkpoint 9 adds a guarded real-RLS integration harness for `POST /api/lesson-plan/save`, but the real run is blocked until a non-production Supabase environment is explicitly identified. Checkpoint 10 classified available targets and found no safe local/test/staging Supabase environment. Checkpoint 11 attempted local enablement and found missing runtime tooling plus `lesson_plans` schema-source drift. Checkpoint 12 selected `HYBRID_TRANSITION_REQUIRED` for database source-of-truth recovery and added a static RLS invariant test, but did not create migration SQL. The endpoint remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`, not a cutover candidate.

Checkpoint 13 defines a baseline reconciliation strategy for `lesson_plans`, `saved_lessons`, and `school_templates`, but does not create executable SQL. Authenticated database migration remains blocked by schema reproducibility plus live RLS verification. Non-DB/public Python migration work is a separate track and is not automatically blocked by that authenticated DB blocker.

Checkpoint 15 proved the Checkpoint 14 geo routing seam live against a local FastAPI instance: contract parity, dual-sided routing evidence, Authorization/Cookie exclusion, transport-failure fallback, and rollback all passed (`VALIDATED_BUT_LEFT_ON_NEXT` — no deployed target existed to leave routing enabled against).

Checkpoint 16 built the first real deployment foundation for `backend-python`: a Render Blueprint (`backend-python/render.yaml`), a production-safe start command (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`), request-ID/timing/error-logging middleware, and a `backend-python` CI job (pytest + ruff). No hosting account access existed in-session, so no real deployment occurred; classification is `DEPLOYMENT_READY_EXTERNAL_PROVISIONING_REQUIRED`. See `FASTAPI_DEPLOYMENT_DECISION.md` and `FASTAPI_DEPLOYMENT_RUNBOOK.md`.

Checkpoint 17 re-confirmed the same account-access gap and attempted no further deployment work (`EXTERNAL_PROVISIONING_BLOCKED`).

Checkpoint 18, with external provisioning still blocked, continued useful repository-side work: selected `POST /api/auth/verify-captcha` as the second Track B pilot from a 5-candidate shortlist (see `VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md`), froze its contract, implemented Python parity, and generalized the geo routing seam to support a second allowlisted endpoint with its own disabled-by-default opt-in (`BACKEND_ROUTE_VERIFY_CAPTCHA`). Also found, while reviewing candidates, that `feedback`/`waitlist`/`school-register` perform privileged Supabase service-role writes — undersold by their prior `PYTHON_PARITY` label — and re-classified them `NEXT_ONLY` pending a mutation-safe migration design.

## Migration Tracks

| Track | Status | Examples | Blocker |
| --- | --- | --- | --- |
| Track A: authenticated DB migration | blocked for cutover | `POST /api/lesson-plan/save`, future saved lesson CRUD | reproducible schema plus live RLS integration |
| Track B: non-DB/public migration | not blocked by RLS schema drift, but blocked on deployment | `GET /api/geo`, `POST /api/auth/verify-captcha` | endpoint-specific parity done for both; both `ROUTING_READY`/`CUTOVER_VALIDATED` pending a real FastAPI deployment target |

## Cutover Readiness Matrix

| Endpoint | Python parity | DB dependency | Auth dependency | Live integration required | Cutover blocker |
| --- | --- | --- | --- | --- | --- |
| `GET /api/geo` | Yes | None | None | No | None known; still no traffic cutover |
| `POST /api/auth/verify-captcha` | Yes | None | None | No | None known beyond deployment; no fallback on Python transport failure by design (single-use Turnstile token) |
| `POST /api/lesson-plan/save` | Yes | `lesson_plans` and owner RLS | Supabase bearer token | Yes | schema reproducibility and safe RLS target |
| `POST /api/lesson-plan` | No cutover parity | usage, generation events, AI providers | Supabase auth/session | Yes | quota, streaming, provider payload parity |
| `POST /api/question-paper` | Not promoted | usage, generation persistence, AI providers | Supabase auth/session | Yes | quota and AI/persistence parity |
| `POST /api/razorpay/webhook` | No | billing tables | Razorpay HMAC/service-role writes | Yes | money-impacting webhook replay and idempotency |

## Temporary Strangler Routing

Checkpoint 14 introduces a small Next route-boundary routing seam for eligible Track B endpoints:

```text
Browser keeps stable /api/... URL
  -> Next migration seam
  -> existing Next implementation or explicit Python proxy
```

For the pilot, only `GET /api/geo` is allowlisted. The default remains the existing Next geo service; Python is selected only when server-side configuration explicitly sets `BACKEND_ROUTE_GEO=python` and `PYTHON_BACKEND_URL` is valid.

This is migration infrastructure, not the final topology. It avoids frontend URL churn while parity is being proven. After the repository/deployment split matures, traffic can move to the final backend route shape selected by deployment architecture.

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
- No currently runnable local Supabase stack or marked test/staging Supabase project exists for authenticated RLS integration verification; `SUPABASE_SCHEMA_DRIFT.md` must be resolved before local reset can be trusted.
