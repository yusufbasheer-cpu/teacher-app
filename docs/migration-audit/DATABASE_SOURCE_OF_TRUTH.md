# Database Source Of Truth

Date: 2026-09-01

## Current Answer

Current source of truth: `HYBRID_TRANSITION_REQUIRED`.

The repository does not currently have one fully reliable database authority for a fresh Supabase environment.

- `supabase/schema.sql` is the only tracked SQL source that creates `public.lesson_plans` with its intended owner RLS policies.
- `supabase/migrations/` is the forward-change history for many later objects, but it does not include the initial `lesson_plans` or `saved_lessons` base-table creation.
- Some schema instructions still live in application comments or route fallback code, notably `school_templates`.

## What Should Become Canonical

Ordered migrations should become canonical for fresh environment creation.

`supabase/schema.sql` should become a generated or explicitly maintained schema snapshot, not a second independent authority.

## Fresh DB Creation

Not reproducible yet from migrations alone.

Before a fresh local Supabase database can be trusted for authenticated RLS verification, the repo needs one of these reconciliations:

1. a reviewed baseline migration that creates pre-existing tables such as `lesson_plans` and `saved_lessons`, followed by existing migrations
2. a documented bootstrap workflow that loads `supabase/schema.sql` first, then applies compatible later migrations
3. a regenerated ordered migration history from an authoritative non-production clone of the deployed schema

Do not choose a reduced one-table bootstrap for security evidence.

## schema.sql Maintenance

Current role: `MANUAL_BOOTSTRAP / PARTIAL_SCHEMA_SNAPSHOT`.

Evidence:

- It existed from the first commit.
- It contains `lesson_plans`, `active_sessions`, and `user_usage`.
- It does not contain many later tables represented by migrations, such as billing, admin, school, and moderation tables.
- No generation command or CI check maintains it.

Future role: generated or reviewed snapshot derived from canonical migrations.

## RLS Policy Location

Today, `lesson_plans` RLS lives in `supabase/schema.sql`, with later update/delete policy changes in migrations.

Future changes to RLS should be made through ordered migrations, with static tests protecting critical owner-policy invariants.

## Migration Naming And Order

Current convention: timestamp-prefixed SQL files under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.

Future backend/database changes should:

- use that timestamp convention
- be idempotent where existing deployed objects may already exist
- avoid production identifiers or secrets
- document fresh-install behavior separately from existing-environment upgrade behavior
- update `schema.sql` only as a derived/reviewed snapshot

## Avoiding Drift

Recommended controls:

- Add baseline/reconciliation migrations for pre-existing tables before local Supabase reset is used as evidence.
- Add static tests for critical RLS policy fragments.
- Add a documented command for regenerating or validating `schema.sql` after migrations once Supabase CLI/Docker are available.
- Keep application-comment SQL, such as `school_templates`, out of runtime code by moving it into reviewed migrations.

## Unresolved

- Whether deployed production/staging has objects not represented in either `schema.sql` or migrations.
- Whether `schema.sql` was manually authored or exported from an early Supabase project.
- The canonical base definition for `saved_lessons`.
- The canonical migration path for `school_templates`.
- Whether future migrations should reconcile existing deployed environments with `IF NOT EXISTS` / `DROP POLICY IF EXISTS` patterns or require a one-time audited baseline.
