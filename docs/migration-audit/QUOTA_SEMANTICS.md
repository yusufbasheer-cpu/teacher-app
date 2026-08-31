# Quota Semantics

Date: 2026-08-31

This captures the current quota and usage flow that later backend work must preserve.

## Current Shape

- Browser-side bootstrap still calls `ensure_user_usage` through `src/lib/user-usage-client.ts`.
- Server-side usage enforcement lives in `src/lib/user-usage-server.ts`.
- Generation routes rely on usage reservation/consumption behavior to decide whether a request can proceed.

## Required Invariants

- Do not change reservation timing without a contract test.
- Do not change refund behavior for failed generations without a contract test.
- Do not change monthly reset behavior, suspension handling, or plan-limit resolution.
- Lesson DeepSeek transport may move behind a provider seam, but quota reservation/refund still belongs in the route.

## Migration Risks

- Concurrency: usage rows are locked and updated atomically.
- Business impact: quota bugs directly affect whether a teacher can generate content.
- Recovery: bad usage writes are much harder to reconcile than read-only API changes.
