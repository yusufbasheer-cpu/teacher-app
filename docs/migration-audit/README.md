# Migration Audit

Date: 2026-08-31

Scope: read-only repository audit for splitting the current Layah teacher app into separate frontend, Python backend, and AI services repositories. No runtime code, dependency versions, schemas, deployment config, or environment values were changed.

## Executive Findings

- Frontend: Next.js App Router, React 19, TypeScript, Tailwind CSS 4, shadcn-style primitives, Supabase SSR/browser auth helpers.
- Current backend: primarily Next.js route handlers in `src/app/api`, plus a standalone Flask service in `python-ppt-api`.
- AI architecture: DeepSeek text generation in Next route handlers and helpers; fal.ai FLUX and Pexels image resolution in `src/lib`; AI usage quota and analytics are coupled to Supabase and plan logic.
- Database/storage: Supabase Auth + Postgres, raw SQL migrations in `supabase/migrations`, RLS policies, service-role admin access, `school_templates.file_data` base64 storage for uploaded templates.
- Deployment: Next app targets Vercel; `vercel.json` defines one cron; CI runs on GitHub Actions; Python PPT service has Render/Railway/Procfile config but active host is not proven from repo.
- Frontend routes discovered: 26 `page.tsx` screens.
- Next API route files discovered: 80.
- HTTP operations discovered in Next route files: 84 (`GET` 24, `POST` 53, `PATCH` 1, `DELETE` 6). Python PPT API adds `GET /health` and `POST /generate-ppt`.
- Recommended split: 3 repositories: `repo-frontend`, `repo-backend-python`, `repo-ai-services`.
- Recommended Python backend: FastAPI, Pydantic, SQLAlchemy/SQLModel, Alembic, Supabase JWT verification, HTTPX provider clients, OpenAPI contract; add Celery/RQ only if async queues are introduced.
- Phase 1 baseline checkpoint is now documented in `PHASE_1_BASELINE.md`.

## Documents

- [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md)
- [FEATURE_MATRIX.md](FEATURE_MATRIX.md)
- [ROUTES_AND_SCREENS.md](ROUTES_AND_SCREENS.md)
- [API_INVENTORY.md](API_INVENTORY.md)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- [DATABASE_SOURCE_OF_TRUTH.md](DATABASE_SOURCE_OF_TRUTH.md)
- [SUPABASE_SCHEMA_DRIFT.md](SUPABASE_SCHEMA_DRIFT.md)
- [LOCAL_SUPABASE_TESTING.md](LOCAL_SUPABASE_TESTING.md)
- [DATA_FLOW.md](DATA_FLOW.md)
- [AUTH_ARCHITECTURE.md](AUTH_ARCHITECTURE.md)
- [THIRD_PARTY_INTEGRATIONS.md](THIRD_PARTY_INTEGRATIONS.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)
- [BACKGROUND_JOBS.md](BACKGROUND_JOBS.md)
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md)
- [ENVIRONMENT_COMPARISON.md](ENVIRONMENT_COMPARISON.md)
- [COMPONENT_OWNERSHIP_MATRIX.md](COMPONENT_OWNERSHIP_MATRIX.md)
- [PYTHON_BACKEND_MIGRATION.md](PYTHON_BACKEND_MIGRATION.md)
- [TARGET_REPOSITORY_ARCHITECTURE.md](TARGET_REPOSITORY_ARCHITECTURE.md)
- [DEPENDENCY_GRAPH.md](DEPENDENCY_GRAPH.md)
- [TEST_INVENTORY.md](TEST_INVENTORY.md)
- [MIGRATION_REGRESSION_PLAN.md](MIGRATION_REGRESSION_PLAN.md)
- [SECURITY_AND_MIGRATION_RISKS.md](SECURITY_AND_MIGRATION_RISKS.md)
- [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md)
- [MIGRATION_MASTER_PLAN.md](MIGRATION_MASTER_PLAN.md)
- [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
- [MIGRATION_DECISIONS.md](MIGRATION_DECISIONS.md)
- [PHASE_1_BASELINE.md](PHASE_1_BASELINE.md)
- [FRONTEND_NETWORK_BOUNDARY.md](FRONTEND_NETWORK_BOUNDARY.md)
- [API_CONTRACT_BASELINE.md](API_CONTRACT_BASELINE.md)
- [DIRECT_SUPABASE_USAGE.md](DIRECT_SUPABASE_USAGE.md)
- [QUOTA_SEMANTICS.md](QUOTA_SEMANTICS.md)
- [AUTH_CONTRACT_BASELINE.md](AUTH_CONTRACT_BASELINE.md)
- [RAZORPAY_CONTRACT_BASELINE.md](RAZORPAY_CONTRACT_BASELINE.md)
- [STREAMING_CONTRACT.md](STREAMING_CONTRACT.md)
- [LESSON_PERSISTENCE_CONTRACT.md](LESSON_PERSISTENCE_CONTRACT.md)
- [PPT_SERVICE_OWNERSHIP.md](PPT_SERVICE_OWNERSHIP.md)
- [FUTURE_SERVICE_CONTRACTS.md](FUTURE_SERVICE_CONTRACTS.md)

## Direct Boundary Answers

- Is the frontend cleanly separable today? Partially. UI screens/components are identifiable, but many client flows directly depend on Supabase browser auth, Supabase table writes, and Next API route shape.
- Is the backend cleanly separable today? No. Backend behavior is embedded in the Next.js app router and `src/lib` modules that also support frontend code.
- Is AI functionality cleanly separable today? Partially. AI provider modules are identifiable, but generation routes mix AI orchestration with auth, plan entitlements, usage metering, persistence, image generation, and response streaming.
- What crosses boundaries? Supabase auth/session handling, usage gating, plan entitlements, AI generation, exports, content persistence/moderation, billing reconciliation, school admin operations, and client-side saved lesson writes.
- What is most likely to break if split immediately? Auth/session propagation, quota reservation/refund semantics, AI streaming responses, Razorpay webhook reconciliation, school enrollment/admin authorization, and client-side `lesson_plans` writes.
- What needs stabilization first? API contracts, endpoint parity tests, auth compatibility contract, webhook replay tests, usage-gate tests, content persistence ownership, and an explicit frontend API client boundary.

## Source Evidence

Primary source files inspected include `README.md`, `package.json`, `next.config.ts`, `vercel.json`, `.github/workflows/ci.yml`, `src/proxy.ts`, `src/app/**/page.tsx`, `src/app/api/**/route.ts`, `src/lib/**`, `supabase/schema.sql`, `supabase/migrations/**`, `python-ppt-api/main.py`, `python-ppt-api/render.yaml`, `python-ppt-api/railway.json`, and `vitest.config.ts`.
