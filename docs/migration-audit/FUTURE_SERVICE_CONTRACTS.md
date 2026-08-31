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

## Business-Data Boundary

- Low-risk browser-side business mutations should move only after their contracts are documented.
- Saved lesson persistence remains a special case and should not be rushed.

