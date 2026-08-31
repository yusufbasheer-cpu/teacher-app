# Backend Service Boundary

Date: 2026-08-31

This document captures the first proven service patterns for Phase 1 boundary stabilization.

## 1. Geo Read / External Integration

Shape:

```text
GET /api/geo
    -> route handler
    -> src/lib/geo-service.ts
    -> external geo providers
```

Responsibilities:

- Route handler owns HTTP details and response shaping.
- `geo-service` owns provider ordering, fallback logic, and normalization.
- Provider calls remain outside the route so the transport layer stays thin.

## 2. Authenticated Persistence / RLS

Shape:

```text
POST /api/lesson-plan/save
    -> route handler
    -> authenticated caller-context Supabase client
    -> src/lib/lesson-plan-save.ts
    -> Supabase RLS
    -> lesson_plans
```

Responsibilities:

- Route handler owns request parsing, authentication lookup, and HTTP status mapping.
- `lesson-plan-save` owns insert vs update selection, payload building, and result normalization.
- Supabase access stays caller-context based so RLS continues to enforce ownership.

## Dependency Direction

- Frontend code should talk to local backend routes through the frontend API client.
- Route handlers may call server-only services.
- Server-only services may call Supabase and external integrations.
- Server-only services should not import browser-only code or the frontend API client.

## Why No Generic Repository Layer

We already have enough proof to extract small service seams without adding a new abstraction family.
Introducing repositories or DI containers now would add shape without reducing risk.
The current goal is to preserve observable behavior while making the route/service split clear.

## FastAPI Mapping

These patterns translate cleanly to a later FastAPI backend:

- route handler -> FastAPI endpoint
- service module -> application service
- caller-context Supabase client -> authenticated backend persistence adapter
- RLS -> database-enforced ownership

