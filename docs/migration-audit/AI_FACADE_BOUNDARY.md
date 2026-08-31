# AI Facade Boundary

Date: 2026-08-31

This document captures the first proven AI facade seam for Phase 1 boundary stabilization.

## Proven Shape

```text
application
    -> AI facade
        -> existing DeepSeek helper
        -> existing fal helper
        -> existing Pexels helper
```

## Route and Service Responsibilities

- Application routes keep request parsing, auth, response mapping, quota behavior, and feature gates.
- The AI facade exposes provider-facing functions without letting application code depend on provider modules directly.
- Provider helpers continue to own the actual HTTP calls, prompt-specific logic, logging, and provider-specific error normalization.

## Current Adoption

- `src/app/api/question-paper/route.ts` and `src/app/api/question-paper/blueprint/route.ts` now call the AI facade for DeepSeek.
- `src/lib/ppt-image-resolver.ts` now reaches fal and Pexels through the AI facade for PPT image resolution.
- `src/app/api/lesson-plan/route.ts` still contains direct DeepSeek orchestration because that route is high-churn and intentionally left untouched in this checkpoint.

## Why This Shape

- It inverts the dependency without changing prompts, model IDs, temperatures, retries, or payload shapes.
- It is small enough to test with passthrough mocks.
- It gives the future Python AI service a concrete interface pattern without forcing a filesystem reorg yet.

