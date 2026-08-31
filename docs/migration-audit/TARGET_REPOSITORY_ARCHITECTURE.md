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
