# Streaming Contract

Date: 2026-08-31

## Lesson Plan Streaming

- `POST /api/lesson-plan` can return NDJSON when the client requests streaming with PPT/image work in progress.
- The browser client treats `application/x-ndjson` as a line-delimited event stream.
- Each line is parsed as JSON independently.

## Event Semantics

- `type: "progress"` updates the loading state.
- `type: "complete"` carries the final lesson payload.
- Non-JSON lines are ignored with a warning.

## Preservation Rules

- Do not change the MIME type or event envelope without a dedicated contract test.
- Do not change the order of progress/completion semantics unless the client is updated at the same time.
- DeepSeek lesson transport changes must not alter the stream envelope; they are strictly provider-internal.
