# Lesson Plans Mutation Contract

Date: 2026-09-01

## Endpoint

`POST /api/lesson-plan/save`

Authoritative production implementation: Next.js route.

Python status: parity pilot only; no frontend traffic is routed to Python.

## Authentication

- Browser callers send `Authorization: Bearer <Supabase access token>`.
- Python validates the bearer with Supabase Auth `/auth/v1/user`.
- Python derives `user_id` from the validated Supabase user response.
- Request payload ownership fields are ignored and must not override the authenticated principal.

## Persistence

Table: `public.lesson_plans`.

Insert behavior:

- status `201`
- response `{ "action": "inserted", "id": "<uuid>" }`
- row `user_id` is the authenticated principal

Update behavior:

- status `200`
- response `{ "action": "updated", "id": "<activePlanId>" }`
- Python filters by `id` and authenticated `user_id`
- RLS must still be active and enforce ownership

## RLS Contract

Source evidence: `supabase/schema.sql`.

- Insert: `WITH CHECK (auth.uid() = user_id)`
- Select: `USING (auth.uid() = user_id)`
- Update: `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`
- Delete: `USING (auth.uid() = user_id)`

The database policy is the security boundary. Application filters are defense in depth.

## Cross-User Contract

User A must not be able to:

- insert a row owned by User B
- update a row owned by User B
- change ownership of an existing row to User B
- influence ownership by submitting `user_id` in the request body

## Checkpoint 9 Status

Real isolated RLS integration verification is not yet complete. The integration harness exists, but the run is blocked until a non-production Supabase target is explicitly configured.

Checkpoint 10 status: `PYTHON_PARITY_WITH_DOCUMENTED_BLOCKER`. No safe local, dedicated test, or controlled staging Supabase environment was identified from repository evidence.
