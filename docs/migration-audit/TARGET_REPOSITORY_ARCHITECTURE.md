# Target Repository Architecture

## Recommendation

Use three repos:

1. `repo-frontend`
2. `repo-backend-python`
3. `repo-ai-services`

Reason: AI provider/orchestration code is large, volatile, and cost-sensitive; backend business logic/billing/auth should stay separate from model prompt experimentation.

## repo-frontend

Responsibilities:

- Next.js App Router frontend in current framework/language.
- UI components, pages, client state, analytics provider.
- Typed generated API client from backend OpenAPI.
- Public static assets.

Must not own:

- Service-role Supabase key.
- Razorpay secrets/webhook validation.
- DeepSeek/fal/Pexels provider keys.
- Quota mutation source of truth.

Deployment: Vercel or equivalent static/SSR host.

## repo-backend-python

Responsibilities:

- Public application API.
- Auth verification, authorization, admin checks.
- Supabase/Postgres persistence and migrations.
- Usage quota and entitlement source of truth.
- Billing, webhooks, email, cron.
- Export/extraction/document services unless split later.
- Backend-to-AI service calls.

Deployment: Python web service with separate cron/scheduler and secure secrets.

## repo-ai-services

Responsibilities:

- DeepSeek prompt orchestration and provider adapters.
- fal.ai/Pexels media generation/resolution.
- AI output parsing/normalization.
- Provider retries/timeouts/fallbacks.
- Cost/provider telemetry.

Must not own:

- User-facing auth decisions.
- Billing plan truth.
- Direct service-role admin operations except tightly scoped writebacks if explicitly designed.

## Shared Contracts

Prefer explicit contracts:

- OpenAPI for frontend <-> backend.
- JSON Schema/Pydantic models for backend <-> AI.
- Versioned event schemas for async generation/billing if queues are introduced.
- Generated TypeScript API client in frontend.
- Avoid sharing runtime TypeScript/Python code across repos.

## Checkpoint 24 Split Readiness

See `REPO_SPLIT_READINESS.md` for the current physical split manifest,
subsystem readiness matrix, and future frontend/backend/AI network
contract.

Current conclusion: repo split preparation can continue, but the
backend-python repository should not be treated as fully proven for
authenticated Supabase-backed endpoints until local disposable Supabase
passes `npm run test:rls`.

## Checkpoint 26 Physical Backend Extraction

The backend-python target repository now exists locally:

`C:\Liyaah\layah-backend-python`

Initial standalone commit:

`735453de6adf2a00b0f90625ff28892f7a28f14f`

This is a local extraction only. The GitHub remote still needs to be
created or connected before it can become the shared canonical repo.
The monorepo copy remains in place as a temporary fallback, and no
frontend, AI-services, production routing, billing, admin, cron, or PPT
split was performed.

## Checkpoint 27 Remote Validation

`repo-backend-python` now exists as:

`https://github.com/yusufbasheer-cpu/layah-backend-python`

Final validated backend SHA:

`b7f2c5b0ee1b08e75f49380f700468d6adf2f466`

Remote CI passed, and frontend Preview routing to a standalone backend
Preview was verified for `GET /api/geo`. From this point, new backend
development should target the standalone repo. The monorepo backend copy
remains a transitional fallback until an explicit cleanup checkpoint.

`repo-frontend` also exists as
`https://github.com/yusufbasheer-cpu/layah-frontend`, but this checkpoint
did not move or push frontend source into it.
