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
