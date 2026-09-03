# Repo Split Readiness

Date: 2026-09-03

Checkpoint: 24

Status: `AUTHENTICATED_BACKEND_FOUNDATION_READY_TO_SPLIT`.

## Current Readiness Matrix

| Subsystem | Classification | Reason |
| --- | --- | --- |
| Frontend | `NEEDS_BOUNDARY_WORK` | UI can stay in Next, but browser components still depend on Next route handlers and some direct Supabase browser data paths. |
| Backend foundation | `READY_TO_SPLIT` | FastAPI authenticated lesson-plan/save has live local proof through Supabase Auth, caller-context PostgREST, anon key, and RLS. |
| Backend product surface | `NEEDS_BOUNDARY_WORK` | Geo, verify-captcha, and lesson-plan/save have evidence, but most remaining routes still need endpoint-specific migration contracts. |
| AI | `NEEDS_BOUNDARY_WORK` | AI facade/provider seams exist, but generation routes still own orchestration, quota, streaming, and persistence. |
| PPT/export | `NEEDS_BOUNDARY_WORK` | Mostly document/export infrastructure, not pure AI. Keep with backend/export ownership until AI-provider-specific image work is separated. |
| Billing | `BLOCKED` | Razorpay/webhook/payment state is high-risk and remains Next-owned until replay/idempotency tests and backend auth boundaries exist. |
| Admin | `BLOCKED` | Privileged school/admin routes require strong authorization parity and safe Supabase service-role handling. |
| Cron | `NEEDS_BOUNDARY_WORK` | Scheduler ownership and cron-secret contract need backend deployment decisions before movement. |

## Initial Physical Split Manifest

### Frontend Repo

Keep:

- Next.js pages, layouts, and app shell
- `src/components`
- browser hooks/state
- `src/lib/frontend-api-client.ts`
- public assets
- frontend-only analytics/provider setup
- frontend environment examples without backend/provider secrets

Exclude once replaced:

- Next route handlers that have been fully cut over
- service-role Supabase helpers
- Razorpay secrets/webhook verification
- AI provider secrets and prompt-provider integrations

### Backend-Python Repo

Move or retain:

- `backend-python/`
- API contracts and generated OpenAPI
- auth validation middleware
- Supabase caller-context integration
- explicit business-rule services
- quota/billing orchestration when migrated
- server-side integrations that enforce product rules
- database migrations once source-of-truth ownership is finalized

### AI-Services Repo

Eventually move:

- DeepSeek provider integration
- fal.ai provider integration
- Pexels provider integration
- prompt/provider-specific modules
- output parsing and provider normalization
- image generation and future voice generation provider code

Do not move:

- billing rules
- user permissions
- quota enforcement
- direct browser trust
- application authorization

## Future Network Contract

```text
frontend
  -> backend-python
  -> ai-services
```

Frontend to backend:

- base URL from frontend deployment configuration
- browser session supplies bearer token where required
- backend validates auth and derives identity server-side
- frontend consumes stable JSON/error/stream contracts

Backend to AI services:

- base URL from backend server-side configuration
- backend remains orchestrator for auth, permissions, quotas, billing, and persistence
- AI service receives normalized work requests only
- internal service authentication required before production use
- request IDs/correlation should propagate across backend and AI service calls
- timeouts must be explicit per workflow
- streaming must flow backend-controlled to frontend; AI service must not be browser-addressable

Error envelope philosophy:

- preserve current public endpoint contracts during migration
- make backend-to-AI errors typed enough for retries/fallbacks
- do not expose provider secrets, raw prompts, or internal topology to the browser

## Checkpoint 25 Update

Docker Desktop is installed and the local Docker daemon is reachable
through the WSL2 backend. `npx supabase start`, `npx supabase db reset`,
and `npm run test:rls` pass against `LOCAL_DISPOSABLE` Supabase.

The authenticated backend foundation is now live-proven enough to create
the physical `backend-python` repository next. This does not promote
billing, admin, cron, or AI-service ownership to ready; those remain
separate subsystem migrations.
