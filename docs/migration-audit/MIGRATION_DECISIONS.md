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

## 2026-09-01

Decision: Refuse real Supabase RLS mutation tests unless the target is explicitly marked local, dedicated test, or controlled staging.

Reason: The repository has Supabase migrations and a schema snapshot, but no runnable local Supabase config/runtime was available, and the only present `.env.local` Supabase project had no non-production marker. Running authenticated write tests against an ambiguous project would violate the migration safety rules.

Alternatives considered: Using the existing `.env.local` credentials, assuming the hosted project was safe, or skipping integration infrastructure entirely.

Impact: Checkpoint 9 adds a guarded integration harness and blocker documentation, but `POST /api/lesson-plan/save` remains `PYTHON_PARITY` until the harness passes against a proven non-production Supabase environment.

Status: Implemented.

## 2026-08-31

Decision: Introduce an internal AI facade before physically reorganizing provider modules.

Reason: A thin facade lets application code depend on one internal boundary while preserving the existing DeepSeek, fal, and Pexels helper implementations unchanged.

Alternatives considered: Moving provider files immediately, or leaving the direct imports in place until the AI service split.

Impact: `src/lib/ai-facade.ts` now serves as the dependency-inversion layer for selected question-paper and PPT image paths, without changing prompts, model IDs, or provider payloads.

Status: Implemented.

## 2026-08-31

Decision: Treat the lesson-plan save flow as the first proven authenticated persistence service boundary.

Reason: The route already preserves caller-context Supabase access and RLS, and the service module stays focused on insert/update semantics without HTTP concerns.

Alternatives considered: Moving `saved_lessons` first, introducing a generic repository layer, or pushing service-role persistence into the boundary.

Impact: `src/lib/lesson-plan-save.ts` is now documented as a server-only service seam, and the route/service split has a concrete reference implementation for the later FastAPI migration.

Status: Implemented.

## 2026-08-31

Decision: Keep backend service extraction focused on low-risk stateless helpers first.

Reason: The route surface still contains high-risk billing, auth, quota, and AI flows. Starting with geo lookup proves the service boundary pattern without changing business-side behavior.

Alternatives considered: Extracting service helpers from billing, school admin, or lesson-generation routes first.

Impact: `src/app/api/geo/route.ts` now delegates to `src/lib/geo-service.ts` with behavior preserved.

Status: Implemented.

## 2026-08-31

Decision: Move lesson-plan DeepSeek transport behind a lesson-specific provider before broader AI service cleanup.

Reason: The lesson route already owns high-risk policy, quota, streaming, and persistence concerns. Extracting only the DeepSeek request/response mechanics reduces surface area without changing prompts, models, or output envelopes.

Alternatives considered: Leaving the fetches inline until a larger AI refactor or moving all lesson orchestration into the provider.

Impact: `src/lib/deepseek-lesson-provider.ts` now owns the lesson DeepSeek HTTP contract, while `src/app/api/lesson-plan/route.ts` keeps business orchestration and response shaping.

Status: Implemented.

## 2026-09-01

Decision: Implement the first FastAPI authenticated endpoint as a no-cutover `lesson-plan/save` parity pilot using Supabase Auth validation plus caller-token PostgREST requests.

Reason: The browser already sends a bearer token, Supabase Auth provides the project-compatible validation boundary, and forwarding that token preserves RLS without introducing service-role persistence or guessed local JWT configuration.

Alternatives considered: Local JWT/JWKS verification before the Supabase signing configuration was established, service-role writes, direct Postgres access, or moving frontend traffic.

Impact: Python unit-contract parity is demonstrated; real isolated Supabase RLS integration and all production cutover work remain separate requirements.

Status: Implemented.

## 2026-09-01

Decision: Keep `POST /api/lesson-plan/save` at `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER` after Checkpoint 10.

Reason: The existing `.env.local` Supabase project is real but unclassified, CI uses placeholder Supabase values, and local Supabase cannot be started from current repo/tooling. No target could be positively identified as local, dedicated test, or controlled staging.

Alternatives considered: Running the guarded harness against `.env.local`, creating a hosted Supabase project automatically, or weakening the harness to accept unknown environments.

Impact: No unsafe mutation occurred. Cutover candidacy is blocked only by provisioning/identifying a safe Supabase RLS integration environment and running the existing harness successfully.

Status: Implemented.

## 2026-09-01

Decision: Do not add a local Supabase config or baseline migration until `lesson_plans` schema-source drift is resolved.

Reason: Checkpoint 11 found that Supabase CLI and Docker are unavailable in the current workspace, and the tracked migration chain does not create `public.lesson_plans` before later migrations alter it. Adding a reduced local table or choosing `schema.sql` over migrations without reconciliation would produce misleading RLS evidence.

Alternatives considered: Creating a minimal `supabase/config.toml` immediately, adding a new baseline migration for only `lesson_plans`, loading `schema.sql` manually, or running the harness against the unclassified `.env.local` hosted project.

Impact: The integration harness local guard is stricter, local env documentation exists, and the exact schema/tooling blocker is documented. `POST /api/lesson-plan/save` remains `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`.

Status: Implemented.
