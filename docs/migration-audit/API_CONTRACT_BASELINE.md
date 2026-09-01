# API Contract Baseline

Date: 2026-08-31

This document captures the browser-facing contracts that matter most for the Phase 1 boundary stabilization.

## Current Client Contract Shape

- Authenticated JSON calls use `Authorization: Bearer <access_token>` from `src/lib/auth-headers.ts`.
- Multipart uploads use `getAuthOnlyHeaders()` so the browser can own the `Content-Type` boundary.
- Several client call sites still parse responses directly from `fetch()`; `src/lib/try-parse-api-json.ts` already exists as the shared safe parser for our own API responses.

## Important Response Shapes

### Lesson plan generation

- `POST /api/lesson-plan`
- Content type may be `application/json` or `application/x-ndjson`
- Streaming mode emits newline-delimited JSON objects
- Client expects progress events with `type: "progress"` and a terminal `type: "complete"` payload

### Question paper

- `POST /api/question-paper`
- `POST /api/question-paper/blueprint`
- Responses are JSON and are parsed defensively in the client

### Differentiated pack

- `POST /api/differentiated-pack`
- `POST /api/differentiated-pack/extract`
- `POST /api/differentiated-pack/infer-meta`
- Exports return files/blobs rather than JSON

### Billing

- Razorpay order/subscription verification routes return JSON contracts used by the payment modal
- Admin billing routes are mutable and must preserve HTTP status codes and error shapes exactly during later migration

### Auth / captcha

- `POST /api/auth/verify-captcha`
- Public, unauthenticated. Request body `{ token?: string }`.
- With no `TURNSTILE_SECRET_KEY` configured, returns `200 {"ok": true}` immediately without parsing the body at all — validation order matters and must be preserved.
- Malformed JSON → `400`; empty/missing token → `400`; Turnstile rejects → `403`; Turnstile transport/parse failure → fails open to `200 {"ok": true}` (Turnstile's HTTP status is never inspected, only whether its body parses as JSON).
- Full frozen contract: `docs/migration-audit/VERIFY_CAPTCHA_PYTHON_PARITY_CONTRACT.md`. Checkpoint 18 added Python parity plus a disabled-by-default routing seam (`BACKEND_ROUTE_VERIFY_CAPTCHA`); default remains Next, and Python transport failures deliberately do **not** fall back to Next (Turnstile tokens are single-use, so a blind retry could turn a valid completion into a false rejection).

### Lesson plan save

- `POST /api/lesson-plan/save`
- Authenticated JSON request body is parsed on the route and passed to a server-only service
- Successful responses preserve `{ action, id }` with `201` for inserts and `200` for updates
- Caller-context Supabase access remains part of the contract so RLS continues to enforce ownership

## Stability Notes

- Route URLs are part of the public contract for the current frontend.
- Later backend migration work should preserve:
  - status codes
  - JSON error envelope shape
  - auth header requirements
  - streaming format
  - file download MIME/filename behavior
