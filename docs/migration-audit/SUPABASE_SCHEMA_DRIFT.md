# Supabase Schema Drift

Date: 2026-09-01

## Status

Result: `BROADER_MIGRATION_DRIFT`

Checkpoint 12 found that `lesson_plans` drift is real, but not isolated. The repo contains a partial schema snapshot plus forward migrations; the migration chain alone cannot recreate every table a fresh Supabase environment needs.

## Schema Source Inventory

| Source | Classification | Evidence |
| --- | --- | --- |
| `supabase/schema.sql` | `MANUAL_BOOTSTRAP / PARTIAL_SCHEMA_SNAPSHOT` | Present from first commit; creates `lesson_plans`, `active_sessions`, and `user_usage`; lacks many later tables represented by migrations; no generation command found. |
| `supabase/migrations/*.sql` | `CANONICAL_MIGRATION` for later changes plus Checkpoint 23/25 fresh baselines | Timestamped forward migration convention; `lesson_plans` and `saved_lessons` now have baseline reconciliation migrations for local reset. |
| `src/lib/pptx-template.ts` embedded SQL comment | `LEGACY / MANUAL_BOOTSTRAP` | Contains `school_templates` setup SQL in a code comment rather than a normal migration. |
| `src/app/api/school-template/upload/route.ts` fallback ALTERs | `LEGACY / RUNTIME_COMPATIBILITY_FALLBACK` | Route-side schema repair for selected `school_templates` columns; not a full schema authority. |
| `.github/workflows/ci.yml` Supabase placeholders | `UNKNOWN / TEST_PLACEHOLDER` | Uses placeholder Supabase env values for CI checks; not a database source. |
| Documentation under `docs/migration-audit/` | `DOCUMENTATION` | Summarizes schema and migration risks; not executable SQL. |

## lesson_plans History

First known appearance: `090f72a2ad2bd62fa6310055c88dd3ea380b23eb` (`first commit`).

In that first commit, `supabase/schema.sql` already created:

- `public.lesson_plans`
- RLS enabled on `public.lesson_plans`
- insert policy
- select policy

Relevant later history:

- `b428cb32fad18194787a9c915c51e2e43be53b03` added curriculum/chapter handling and `supabase/migrations/20260210120000_lesson_plans_curriculum_chapter.sql`; the migration assumes `lesson_plans` already exists.
- `eee56ad33f61fe3735041b8578fac24864dfc9cb` added `curriculum_framework` to `schema.sql` and `supabase/migrations/20260511120000_lesson_plans_curriculum_framework.sql`.
- `2cc3e25` added the delete policy in `supabase/migrations/20260604120000_lesson_plans_delete_policy.sql` and updated `schema.sql`.

No deleted `lesson_plans` base migration was found via `git log --all --diff-filter=D --name-status -- supabase`.

## Current Intended lesson_plans Contract

Verified from `supabase/schema.sql` and cross-checked against `src/lib/lesson-plan-save.ts`, `backend-python/app/services/lesson_plan.py`, TypeScript tests, Python tests, and contract fixtures.

Columns:

| Column | Type | Nullability/default | Source |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, default `gen_random_uuid()` | SQL |
| `user_id` | `uuid` | not null, references `auth.users(id)` on delete cascade | SQL |
| `curriculum_type` | `text` | not null, default `'Other'` | SQL/app write |
| `subject` | `text` | not null | SQL/app write |
| `grade` | `text` | not null | SQL/app write |
| `chapter` | `text` | not null, default `''` | SQL/app write |
| `curriculum_framework` | `text` | not null, default `''` | SQL/app write |
| `topic` | `text` | not null | SQL/app write |
| `learning_objectives` | `text` | not null | SQL/app write |
| `lesson_plan` | `jsonb` | not null | SQL/app write |
| `created_at` | `timestamptz` | not null, default `now()` | SQL |

Constraints/defaults/indexes:

- Primary key: `id`.
- Foreign key: `user_id -> auth.users(id) on delete cascade`.
- No table-specific secondary indexes are present in tracked SQL.
- No unique constraints are present in tracked SQL.

Triggers/functions:

- No `lesson_plans` triggers were found.
- No `lesson_plans`-specific functions were found.
- Required extension/function dependency: `gen_random_uuid()` must be available in the Supabase/Postgres environment.

RLS:

- Enabled with `alter table public.lesson_plans enable row level security`.
- Insert policy: `"Users can insert their own lesson plans"` with `WITH CHECK (auth.uid() = user_id)`.
- Select policy: `"Users can view their own lesson plans"` with `USING (auth.uid() = user_id)`.
- Update policy: `"Users can update their own lesson plans"` with `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`.
- Delete policy: `"Users can delete their own lesson plans"` with `USING (auth.uid() = user_id)`.

## Dependencies

| Dependency | Required for | Notes |
| --- | --- | --- |
| `auth.users` | table creation and FK | Supabase Auth-managed table. |
| `auth.uid()` | RLS | Supabase Auth/PostgREST claim helper. |
| `gen_random_uuid()` | table creation/defaults | Available in Supabase projects; local reset must ensure required extension support. |
| PostgREST authenticated role/claims | app write/RLS | Required for caller-token writes. |
| Supabase anon key | app write/RLS | Public key for API access, not authorization authority. |
| service-role key | test fixture setup only | Must not be used by app mutation. |

## Migrations Vs schema.sql

| Concern | Migration chain result | `schema.sql` result | Semantic difference |
| --- | --- | --- | --- |
| base table | missing | creates `public.lesson_plans` | fresh migration reset fails without bootstrap |
| `id` PK/default | missing | present | missing from migrations |
| `user_id` FK | missing | present | missing from migrations |
| app-write columns | partial alters for later additions only | full current set present | migrations assume earlier table exists |
| RLS enablement | no base enablement migration found | present | fresh reset cannot reach policy contract from migrations alone |
| insert/select policies | no base policy migration found | present | fresh reset missing owner RLS |
| update policy | present as later recreation | present | migration depends on existing table |
| delete policy | present as later creation | present | migration depends on existing table |
| triggers/functions | none found | none found | no conflict found |

## Representative Broader Drift Scan

| Object | Finding | Classification |
| --- | --- | --- |
| `lesson_plans` | base table only in `schema.sql`; later alter/policy migrations exist | drift |
| `saved_lessons` | several alter migrations exist, but no base table creation found | drift |
| `user_usage` | base creation migrations exist and are evolved by later migrations/RPCs | better represented |
| `active_sessions` | base creation migrations exist, plus ensure migration | better represented |
| `school_accounts` / `school_teachers` | represented by migrations | better represented |
| `razorpay_orders` / `subscriptions` | represented by migrations | better represented |
| `school_templates` | setup SQL in code comment and route fallbacks, not normal migration | drift |

Conclusion: `BROADER_MIGRATION_DRIFT`, concentrated around early/pre-existing user content tables and `school_templates`.

## Chosen Strategy

Recommended strategy: `HYBRID_TRANSITION_REQUIRED`.

Near term:

- Treat `supabase/schema.sql` as the verified `lesson_plans` bootstrap contract.
- Treat ordered migrations as canonical for forward changes that are actually represented.
- Do not claim migrations alone are canonical until missing baseline objects are reconciled.

Target state:

- Ordered migrations become canonical for fresh environments.
- `schema.sql` becomes a generated or reviewed snapshot derived from canonical migrations.

## Reconciliation Migration Decision

No reconciliation migration was created in Checkpoint 12.

Reason:

- Historical evidence shows the table existed in `schema.sql` from the first commit, but does not prove the current deployed schema beyond repository state.
- `saved_lessons` and `school_templates` show broader baseline drift, so adding only one `lesson_plans` baseline migration risks creating a partial and misleading local story.
- Existing-database upgrade safety is not proven without inspecting a classified deployed/test schema.

Safe next migration work should first choose a baseline strategy for all missing baseline objects needed by local reset, then create reviewed idempotent SQL or a documented bootstrap path.

Checkpoint 13 chose a documented strategy, not executable SQL.

Recommended model: `BASELINE_PLUS_FORWARD_RECONCILIATION`.

- `lesson_plans` is sufficiently specified for a fresh baseline spec, but existing policy/table drift is still uninspected.
- `saved_lessons` has a clear application contract and later alter migrations, but no tracked base table/RLS policy SQL.
- `school_templates` has embedded setup SQL and route fallback instructions, but no migration and no inspected deployed catalog.

See `SCHEMA_RECONCILIATION_MATRIX.md`, `DATABASE_BASELINE_SPEC.md`, and `SCHEMA_RECONCILIATION_PLAN.md`.

## Production Migration Risk

Do not apply a newly invented baseline migration to production or the unclassified `.env.local` project.

Any future reconciliation migration must separately document:

- behavior on a fresh database
- behavior on an existing database where `lesson_plans` already exists
- policy replacement behavior
- grant behavior
- rollback/recovery instructions

## Static Regression

Checkpoint 12 added `backend-python/tests/test_supabase_schema_contract.py` to protect the critical `lesson_plans` owner-RLS fragments in `supabase/schema.sql`.

This is only a static guard. It does not replace real local Supabase RLS integration.
