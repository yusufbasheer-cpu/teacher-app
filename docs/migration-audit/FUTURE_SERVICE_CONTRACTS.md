# Future Service Contracts

Date: 2026-08-31

These are the service seams that should exist before filesystem cleanup.

## Frontend API Client

Target shape:

```text
Frontend -> our backend API
```

Scope:

- local `"/api/..."` routes only
- auth header handling
- JSON parsing
- uploads and downloads
- streaming helpers where needed

Out of scope:

- generic third-party service wrapping
- browser SDK abstractions for telemetry or checkout providers

## AI Facade

Target shape:

```text
application
    -> AI facade
        -> existing DeepSeek helper
        -> existing fal helper
        -> existing Pexels helper
```

Goals:

- dependency inversion first
- provider normalization first
- filesystem reorganization later

Current proof points:

- `src/app/api/question-paper/route.ts` and `src/app/api/question-paper/blueprint/route.ts` now import DeepSeek through the facade.
- `src/lib/ppt-image-resolver.ts` now imports fal and Pexels helpers through the facade.
- `src/app/api/lesson-plan/route.ts` now imports lesson DeepSeek transport through `src/lib/deepseek-lesson-provider.ts`.

## Lesson Provider

Target shape:

```text
lesson orchestration -> lesson DeepSeek provider -> DeepSeek API
```

Scope:

- lesson-specific DeepSeek URL/model/headers/body construction
- raw-response logging and completion parsing
- cancellation propagation

Out of scope:

- auth, quota, entitlement, streaming, persistence, or prompt policy

## Business-Data Boundary

- Low-risk browser-side business mutations should move only after their contracts are documented.
- Saved lesson persistence remains a special case and should not be rushed.

## Backend Service Boundary

Proven examples:

- `GET /api/geo` -> `src/lib/geo-service.ts`
- `POST /api/lesson-plan/save` -> `src/lib/lesson-plan-save.ts`

These are the reference seams for later FastAPI extraction because they isolate HTTP transport from application logic without changing observable contracts.
