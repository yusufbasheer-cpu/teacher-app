# Migration Master Plan

Principle: strangler migration, not big-bang rewrite.

## Pilot Phase Status (as of Checkpoint 21)

**PILOT_ENDPOINT_MIGRATION_PHASE = COMPLETE.**

Phases 4–5 below were executed as a deliberately narrow, one-endpoint-at-a-
time pilot rather than in full: a FastAPI skeleton was built and deployed
(Vercel, project `teacher-app/layah-backend-python`), and exactly two
low-risk endpoints — `GET /api/geo` and `POST /api/auth/verify-captcha`
— were taken all the way through parity, routing, real Preview-to-Preview
deployment validation, security isolation, observability, and
configuration-only rollback. Both remain on Next by deliberate choice
(Production activation is a separate decision). See
`docs/migration-audit/REMOTE_ROUTING_VALIDATION.md` for the full
evidence trail.

**NEXT MIGRATION MODE = BATCH / SUBSYSTEM WAVES.** The remaining ~80 Next
API routes will not be migrated one-by-one, one-checkpoint-each. Future
work should batch by subsystem, matching the phase groupings below, each
wave proving parity/routing/rollback for its whole batch rather than a
single route.

## Checkpoint 22 Correction: No Further "Low-Risk Public" Wave Exists

Checkpoint 22 investigated all ~84 remaining Next API operations for a
Wave 1 bulk-migration cohort using the infrastructure proven by the pilot.
**None qualify.** The assumption above ("one wave for the remaining
low-risk public endpoints") does not hold — `geo` and `verify-captcha`
were not a sample of a larger low-risk category, they were the *entire*
category. Every other route requires Supabase, auth, an AI provider,
billing, admin authorization, export complexity, or SMTP — see
`BACKEND_WAVE_1_INVESTIGATION.md` for the full per-route classification.
The wave structure below is corrected accordingly: there is no separate
"Wave 1.5" of easy wins waiting — the next real unlock is Wave 2
(authenticated Supabase reads/writes), which is blocked on the database
source-of-truth track plus an unbuilt Authorization-forwarding routing
design, not on migration effort.

## Phase 0: Audit Closure

Objective: fill open questions, provide real URLs, identify active deployments.
Completion: all docs updated with verified production/staging/current differences.
Rollback: documentation-only.

## Phase 1: Contract Freeze

Objective: freeze existing route, auth, response, and side-effect contracts.
Files/services affected: tests, docs, generated OpenAPI draft.
Tests: API contract fixtures, Playwright smoke tests, webhook replay tests.
Rollback: remove new tests/contracts only if incorrect.
Completion: CI proves current behavior.

## Phase 2: Frontend API Boundary

Objective: replace scattered `fetch` and direct Supabase business writes with typed API client calls where practical.
Risk: accidental UI behavior changes.
Rollback: route client calls back to existing endpoints.
Completion: frontend no longer knows backend implementation details for critical flows.

## Phase 3: AI Service Facade

Objective: put DeepSeek/fal/Pexels orchestration behind an internal service interface while keeping Next API endpoints stable.
Risk: streaming and parse-notice regressions.
Rollback: backend facade points back to existing in-process implementation.
Completion: mocked AI service parity tests pass.

## Phase 4: Python Backend Skeleton

Objective: create FastAPI service with auth verification, health, schemas, and low-risk read endpoints.
Risk: auth mismatch.
Rollback: no traffic routed.
Completion: staging can call Python for selected endpoints.

## Phase 5: Low-risk Endpoint Migration

Objective: move `geo`, contact/waitlist/feedback, account export read path, simple usage reads.
Risk: response differences.
Rollback: proxy back to Next route.
Completion: contract parity and staging smoke pass.

## Phase 6: Document/Export Migration

Objective: move extraction and DOCX/PPTX/ZIP exports.
Risk: file compatibility and runtime package differences.
Rollback: route back to Next export APIs.
Completion: fixture files pass sanity checks.

## Phase 7: Admin, School, and Auth-adjacent Migration

Objective: move school enrollment, school admin, HOD, super-admin APIs.
Risk: privilege escalation or tenant isolation bug.
Rollback: route group back to Next.
Completion: denied/allowed tests and seeded tenant tests pass.

## Phase 8: Billing Migration

Objective: move Razorpay APIs and webhooks.
Risk: money-impacting reconciliation bugs.
Rollback: keep old webhook endpoint active until DNS/dashboard switch verified.
Completion: test-mode checkout and webhook replay pass.

## Phase 9: Generation Endpoint Migration

Objective: move lesson/question/differentiated APIs to Python backend + AI service.
Risk: quota/refund, streaming, provider failures, generated content format.
Rollback: endpoint-by-endpoint route fallback.
Completion: parity tests, canary traffic, monitoring, and user acceptance pass.

## Phase 10: Repo Split

Objective: physically split source into three repos.
Prerequisite: all runtime boundaries explicit and deployed.
Completion: independent CI/CD and deployments for frontend/backend/AI.
