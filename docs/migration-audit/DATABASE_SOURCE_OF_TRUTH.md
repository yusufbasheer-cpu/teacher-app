# Database Source Of Truth

Date: 2026-09-01

## Current Answer

Current source of truth: `HYBRID_TRANSITION_REQUIRED`.

The repository does not currently have one fully reliable database authority for a fresh Supabase environment.

- `supabase/schema.sql` is the only tracked SQL source that creates `public.lesson_plans` with its intended owner RLS policies.
- `supabase/migrations/` now includes fresh-baseline reconciliation for
  `lesson_plans` and `saved_lessons`, plus the forward-change history for
  many later objects.
- Some schema instructions still live in application comments or route fallback code, notably `school_templates`.

## What Should Become Canonical

Ordered migrations should become canonical for fresh environment creation.

`supabase/schema.sql` should become a generated or explicitly maintained schema snapshot, not a second independent authority.

## Fresh DB Creation

Fresh local reset is now reproducible from migrations alone for the
current tracked chain.

Checkpoint 25 proved:

1. local Supabase can start from tracked config
2. `npx supabase db reset` can replay the migration chain
3. the authenticated `lesson_plans` RLS harness can run against the fresh
   local schema

This does not mean every historical production object has been fully
catalog-reconciled; `school_templates` remains documented migration debt.

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

## Future Contributor Rule

Every schema change must:

1. have an ordered migration
2. include RLS changes where applicable
3. update or regenerate the reviewed schema snapshot
4. add or update contract tests for security-critical invariants
5. document runtime dependencies or fallback behavior when relevant

No new table, column, policy, index, trigger, or function should originate only from route fallback SQL, application comments, or `supabase/schema.sql`.

## Checkpoint 13 Reconciliation Strategy

Checkpoint 13 separates fresh bootstrap from existing-database upgrade safety.

Current recommendation: `BASELINE_PLUS_FORWARD_RECONCILIATION`, documented in `DATABASE_BASELINE_SPEC.md`, `SCHEMA_RECONCILIATION_MATRIX.md`, and `SCHEMA_RECONCILIATION_PLAN.md`.

No executable migration SQL was created in Checkpoint 13 because existing catalog state and policy drift have not been inspected. `lesson_plans` is verified well enough for a baseline spec, while `saved_lessons` and `school_templates` remain partial contracts that need catalog confirmation before production-safe SQL.

## Unresolved

- Whether deployed production/staging has objects not represented in either `schema.sql` or migrations.
- Whether `schema.sql` was manually authored or exported from an early Supabase project.
- The deployed canonical base definition for `saved_lessons`, including exact RLS policies and indexes.
- The deployed canonical migration path for `school_templates`, including whether the embedded SQL was manually applied.
- Whether future migrations should reconcile existing deployed environments with `IF NOT EXISTS` / `DROP POLICY IF EXISTS` patterns or require a one-time audited baseline.

## Checkpoint 24 Re-Check

Date: 2026-09-03

`supabase db reset` was attempted only against local CLI state. It did
not reach Postgres because Docker/Podman is unavailable. Therefore the
source-of-truth classification does not advance.

- `lesson_plans`: `RECONCILIATION_SQL_WRITTEN_UNTESTED`
- `saved_lessons`: `PARTIAL`
- `school_templates`: `PARTIAL`
- overall: `HYBRID_TRANSITION_REQUIRED`

No hosted database was contacted or mutated.

## Checkpoint 23: `lesson_plans` Reconciliation Written (Not Yet Applied/Tested)

`supabase/migrations/20260101000000_lesson_plans_baseline_reconciliation.sql`
now exists — an existence-guarded migration that creates `lesson_plans`
(exact `DATABASE_BASELINE_SPEC.md`-verified shape: table, RLS, original
insert/select policies) on a fresh database, and is a complete no-op on
any database where the table already exists (no catalog inspection was
possible for any hosted environment, so it deliberately does not touch
policies on an existing table). This makes `lesson_plans` reproducible
from `supabase migration up` alone for the first time.

**Not applied or tested against any live database.** No Supabase CLI, no
Docker, and no positively-classified non-production Supabase target were
available this checkpoint (re-checked; unchanged from Checkpoints 9–13 —
see `AUTHENTICATED_BACKEND_PATTERN.md` for full target-classification
evidence). `saved_lessons` and `school_templates` remain unreconciled —
still `PARTIAL` confidence, deliberately deferred (smallest correct
reconciliation slice for the one endpoint, `lesson-plan/save`, that
actually needs it).

Updated classification: source of truth remains `HYBRID_TRANSITION_REQUIRED`
in practice (nothing was proven live), but `lesson_plans`
reproducibility specifically has moved from `PLANNED_BUT_NOT_EXECUTABLE`
to `RECONCILIATION_SQL_WRITTEN_UNTESTED`.

## Checkpoint 25: Local Reset Proven

Docker Desktop is now available locally and the Supabase CLI can start
the disposable local stack. The first live reset attempt failed at
`20260610120000_saved_lessons_learning_objectives.sql` because
`public.saved_lessons` had no baseline table migration. Checkpoint 25
adds `20260101001000_saved_lessons_baseline_reconciliation.sql`, a
fresh-bootstrap-only, existence-guarded baseline for the app-required
`saved_lessons` fields and owner RLS.

After that reconciliation, `npx supabase db reset` completed
successfully against `LOCAL_DISPOSABLE` Supabase.

- `lesson_plans`: `LOCAL_RESET_VERIFIED`
- `saved_lessons`: `LOCAL_RESET_VERIFIED_BASELINE_RECONCILED`
- `school_templates`: `PARTIAL` (not required by the current reset path;
  still represented by embedded app SQL rather than a canonical
  migration)
- overall: `HYBRID_TRANSITION_REQUIRED`, with authenticated
  `lesson_plans` local proof now complete

## Checkpoint 26: Backend Repo Local Canonical Copy

The extracted backend repository at `C:\Liyaah\layah-backend-python`
contains its own copy of `supabase/` and can run local Supabase reset
and authenticated RLS verification independently.

Until a remote repository is created and branch/source-of-truth rules are
formally adopted, database ownership is:

- extracted backend repo: local canonical candidate for backend-owned
  migrations
- monorepo copy: retained fallback/source compatibility copy
- production Supabase: not contacted or changed in this checkpoint

Overall classification remains `HYBRID_TRANSITION_REQUIRED`, with the
physical backend repository extraction complete locally.

## Checkpoint 27: Backend Repo Remote Canonical Candidate

The backend repository now has a remote:

`https://github.com/yusufbasheer-cpu/layah-backend-python`

Remote CI proved the standalone copy can run Python tests, Ruff, local
Supabase reset, and authenticated RLS integration from GitHub Actions.

The standalone backend repo is now the canonical candidate for
backend-owned `supabase/migrations/`, `supabase/config.toml`, and RLS
test infrastructure. The monorepo copy remains a transitional fallback
until an explicit cleanup checkpoint removes or freezes it.
