# Migration Master Plan

Principle: strangler migration, not big-bang rewrite.

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
