# FastAPI Auth Pilot

Date: 2026-09-01

## Scope

Checkpoint 8 adds `POST /api/lesson-plan/save` to the isolated FastAPI backend as a parity implementation. The Next.js route remains authoritative. No frontend traffic, proxy, deployment, or cutover changed.

## Existing Auth Input

The lesson-plan caller uses the existing `apiJson` client with `auth: "bearer"`. That client obtains the Supabase browser session and sends `Authorization: Bearer <access token>`. Because the request is same-origin, the browser may also send Supabase auth cookies; the current Next route authenticates through its SSR cookie client. The Python pilot uses the already-established bearer header and does not require a frontend contract change.

## Python Authentication

FastAPI extracts a strict bearer token and calls Supabase Auth `GET /auth/v1/user` with the existing public anon key. Supabase validates the token, including its signature and expiry, and returns the user record. Python derives `user_id` only from that validated response; any client-supplied ownership field is ignored because the request model has no `user_id` authority field.

The pilot intentionally does not decode JWTs locally, cache JWKS, or add a second JWT library. Remote Supabase Auth validation is the project-compatible verification mechanism available from the current configuration, and it avoids guessing the project issuer, audience, or signing-key mode.

## Persistence Context

The PostgREST adapter sends:

- `apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `Authorization: Bearer <validated caller token>`
- the same row filters and payload fields as the TypeScript service

`SUPABASE_SERVICE_ROLE_KEY` is not read or used in this flow. Supabase RLS therefore remains active. Updates include both the requested row ID and the authenticated user ID filter, matching the TypeScript service and preventing a User A request from targeting User B's row through this contract.

## Verification Boundary

Unit tests prove token forwarding, payload construction, ownership filtering, generic error handling, and the User A/User B contract. They do not prove a live database policy decision. A dedicated local or isolated staging Supabase integration test is still required before any Python cutover candidate decision.

Checkpoint 9 added that integration test harness, but did not execute it because the only configured Supabase credentials were not labeled as local, dedicated test, or controlled staging. The route therefore remains verified by unit-contract tests only.

## Auth Availability Coupling

Every authenticated FastAPI request currently depends on Supabase Auth `/auth/v1/user`. If that endpoint is slow or unavailable, authenticated Python routes can become slow or fail even when PostgREST and the application are healthy. This checkpoint intentionally does not optimize that behavior; local JWT validation, token caching, or session caching require a separate auth-architecture decision.

## Rollback

Rollback is trivial while no traffic is routed to Python: continue using the existing Next route. The pilot can be disabled or removed without changing production behavior.
