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

## Stability Notes

- Route URLs are part of the public contract for the current frontend.
- Later backend migration work should preserve:
  - status codes
  - JSON error envelope shape
  - auth header requirements
  - streaming format
  - file download MIME/filename behavior

