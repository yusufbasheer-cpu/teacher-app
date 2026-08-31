# Migration Decisions

This file is append-only. Do not edit prior decisions; add superseding decisions below.

## 2026-08-31

Decision: Use a three-repository target architecture by default: frontend, backend-python, and AI services.

Reason: The current code has substantial AI provider orchestration that is cost-sensitive and independently evolvable, while billing/auth/admin/data concerns belong in a backend service.

Alternatives considered: Two repos (`frontend`, `backend-python`) with AI embedded in backend.

Impact: Migration plan must define backend-to-AI contracts and keep auth/usage source of truth in backend.

Status: Proposed.

## 2026-08-31

Decision: Keep the frontend in Next.js/React/TypeScript during migration.

Reason: Existing product is implemented in Next App Router with many working UI flows; rewrite would increase risk without solving boundary issues.

Alternatives considered: Rewriting frontend during split.

Impact: First migration step is API boundary stabilization, not UI rewrite.

Status: Proposed.

## 2026-08-31

Decision: Recommend FastAPI for the Python backend.

Reason: Current APIs are HTTP/JSON with some streaming and many typed request/response shapes; FastAPI/Pydantic fits API-compatible migration and OpenAPI contract generation.

Alternatives considered: Django, Flask-only, serverless Python functions.

Impact: Backend migration plan assumes FastAPI, Pydantic, HTTPX, Supabase JWT verification, and optional SQLAlchemy/Alembic.

Status: Proposed.

## 2026-08-31

Decision: Stabilize the frontend-to-backend API boundary before any broad frontend service abstraction work.

Reason: The current browser code already has many local API calls, but the boundary is inconsistent and mixed with direct Supabase usage. A single client abstraction should represent `Frontend -> our backend API`, not a generic transport layer.

Alternatives considered: Migrating external provider calls and frontend Supabase access into the same first pass.

Impact: Checkpoint 2 should focus on a minimal API client plus contract tests, while preserving separate handling for external providers and direct Supabase auth/session behavior.

Status: Proposed.

## 2026-08-31

Decision: Do not treat `saved_lessons` as the first browser-side Supabase mutation to migrate.

Reason: The contract is migration critical and spans generation, reload, list, and delete flows. `lesson_plans` save/update is the lower-risk first candidate unless later contract analysis shows an even safer mutation.

Alternatives considered: Starting with `saved_lessons` auto-save because it is user-visible and nearby in the generator flow.

Impact: Phase 1 recommendations should name `lesson_plans` save/update as the first candidate for detailed contract hardening.

Status: Proposed.

## 2026-08-31

Decision: Migrate `lesson_plans` save/update behind a backend API route before touching `saved_lessons`.

Reason: The contract is narrower, the call surface is smaller, and it lets us prove the frontend API boundary without moving migration-critical lesson auto-save behavior yet.

Alternatives considered: Moving `saved_lessons` first or bundling both lesson persistence paths into the same diff.

Impact: The first production-code persistence boundary now lives in `POST /api/lesson-plan/save`, while `saved_lessons` remains browser-owned for later review.

Status: Implemented.
