# Supabase Schema Drift

Date: 2026-09-01

## Status

Checkpoint 11 found material drift between the migration chain and `supabase/schema.sql` for the local RLS verification target.

## Finding

`supabase/schema.sql` contains the current `public.lesson_plans` table and its RLS policies.

The tracked migration chain does not contain the initial `create table public.lesson_plans` migration. The only `lesson_plans` migrations found are:

- `supabase/migrations/20260210120000_lesson_plans_curriculum_chapter.sql`
- `supabase/migrations/20260511120000_lesson_plans_curriculum_framework.sql`
- `supabase/migrations/20260604120000_lesson_plans_delete_policy.sql`

Those migrations assume `public.lesson_plans` already exists.

## Impact

A fresh local Supabase database cannot be faithfully initialized from the current migration chain alone. Running local Supabase with only tracked migrations would fail before the RLS integration harness could exercise `lesson_plans`.

Using a handcrafted reduced `lesson_plans` table would weaken the evidence and create a second schema source of truth. Checkpoint 11 therefore stopped before creating a misleading local database.

## Required Resolution

Choose one source-of-truth strategy before running local RLS verification:

1. Add a historical baseline migration that faithfully creates the existing `lesson_plans` table and policies before later alter-policy migrations run.
2. Establish a documented local initialization workflow that loads `supabase/schema.sql` before applying later migrations.
3. Reconcile the whole migration history from a known production/staging schema snapshot, then use the reconciled migrations for local reset.

The chosen approach must preserve:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- all fields written by `POST /api/lesson-plan/save`
- RLS enabled on `public.lesson_plans`
- insert `WITH CHECK (auth.uid() = user_id)`
- select `USING (auth.uid() = user_id)`
- update `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`

## Checkpoint 11 Decision

Do not run local RLS integration tests until this drift is resolved and the local Supabase runtime prerequisites are available.
