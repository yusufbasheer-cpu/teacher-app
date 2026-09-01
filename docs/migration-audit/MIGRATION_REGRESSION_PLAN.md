# Migration Regression Plan

## Before Migration

- Capture OpenAPI-style contracts for every `/api/**` route.
- Add fixtures for successful and failing responses for lesson, question paper, differentiated pack, billing, school admin, and super admin flows.
- Add Playwright smoke tests for public routes and authenticated core routes.
- Add Supabase local/test project with seeded users/plans/schools/admins.
- Add Razorpay webhook replay fixtures for all handled event types.
- Add AI mocked-provider tests that verify prompts, parser behavior, and failure/refund behavior without paid calls.
- Add lesson DeepSeek provider tests that verify URL, model, headers, message order, abort signal propagation, and HTTP failure mapping.
- Add export snapshot tests for DOCX/PPTX/ZIP headers and file sanity.

## During Migration

- Run frontend against legacy Next APIs and Python APIs through an environment switch.
- Compare response status, body schema, error codes, headers, MIME types, filenames, and side effects.
- Shadow low-risk reads before moving writes.
- Canary endpoints one group at a time.
- Keep rollback by routing proxy back to legacy handlers.

## After Migration

- Run full E2E suite against production-like staging.
- Replay webhook fixtures.
- Run quota concurrency tests.
- Compare generated content parser snapshots with mocked DeepSeek payloads.
- Compare lesson DeepSeek provider behavior against the contract in `DEEPSEEK_LESSON_GENERATION_CONTRACT.md`.
- Verify admin audit logs and billing state transitions.
- Decommission legacy handlers only after parity passes and monitoring is quiet.

Checkpoint 8 adds unit-contract coverage for authenticated lesson-plan persistence: bearer validation, server-derived identity, insert/update payloads, caller-token forwarding, ownership filters, generic persistence failures, and the User A/User B update case.

Checkpoint 9 adds an explicit integration test harness at `backend-python/tests/integration/test_lesson_plan_rls.py`. It is skipped unless a non-production Supabase target is deliberately configured with `RUN_SUPABASE_INTEGRATION_TESTS=1`, `ALLOW_SUPABASE_INTEGRATION_MUTATIONS=1`, and `SUPABASE_INTEGRATION_ENVIRONMENT=local|test|staging`. A successful real run is still required before lesson-plan save can become a Python cutover candidate.

Checkpoint 11 hardened the local guard so `SUPABASE_INTEGRATION_ENVIRONMENT=local` requires a localhost URL. It also documented that local Supabase reset is blocked until runtime tooling exists and `SUPABASE_SCHEMA_DRIFT.md` is resolved.

## Critical User Journeys

- signup/login/logout/OAuth callback
- generate lesson package with and without PPT/images/source/AFL/strategy
- save/list/view/regenerate/export lesson
- generate question paper with optional blueprint and downloads
- generate differentiated packs from lesson and upload
- upgrade/cancel subscription and receive webhook updates
- account export/delete
- school registration/approval/enrollment/admin teacher management
- super-admin users/schools/admins/content/billing/announcements
