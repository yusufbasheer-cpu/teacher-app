# DeepSeek Lesson Generation Contract

Date: 2026-08-31

This contract captures the lesson-generation seam that now sits behind `src/lib/deepseek-lesson-provider.ts`.

## Boundary Shape

```text
lesson-plan route -> lesson orchestration -> lesson DeepSeek provider -> DeepSeek API
```

## Must Preserve

- URL: `https://api.deepseek.com/chat/completions`
- Method: `POST`
- Model: `deepseek-chat`
- Headers: `Content-Type: application/json` and `Authorization: Bearer <api key>`
- Message order: system message first, user message second
- Request options: temperature, max_tokens, and optional `AbortSignal`
- Logging: raw provider response is logged before parsing
- Parsing: JSON body parsing with the existing DeepSeek completion parser
- Errors: HTTP 401/402/429 mapping and generic truncated-body fallback

## Lesson Route Responsibilities

- auth, entitlement, rate limits, spending protection, and quota reservation
- prompt assembly for lesson sections and AFL sheets
- streaming envelope and completion/error events
- persistence and downstream response shaping

## Provider Responsibilities

- DeepSeek request transport
- request/response normalization
- raw-response logging
- cancellation propagation

## Non-Goals

- prompt rewrites
- model changes
- retry policy changes
- response schema changes
- moving business rules into AI code

