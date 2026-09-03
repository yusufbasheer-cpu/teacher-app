# Schema Reconciliation Plan

Date: 2026-09-01

Status: `LOCAL_RESET_RECONCILED_FOR_AUTHENTICATED_LESSON_SAVE`.

Checkpoint 25 implements the minimal reconciliation needed for fresh
local reset and authenticated lesson-save RLS verification.

## Chosen History Model

Recommended model: `BASELINE_PLUS_FORWARD_RECONCILIATION`.

Rationale:

- Fresh databases need a reviewed baseline for objects that predate tracked migrations.
- Existing hosted databases may already have later migration versions recorded, so adding a newly old-dated migration can confuse migration history.
- Existing databases also need safe conditional reconciliation, not a blind recreation of tables and policies.

Rejected for now:

- `EARLY_BASELINE_MIGRATION` only: good for fresh reset, risky for existing migration history.
- `FORWARD_RECONCILIATION_MIGRATION` only: can patch existing deployments, but does not cleanly model the historical baseline for fresh reset without careful conditional SQL.
- `DOCUMENTED BASELINE SNAPSHOT ONLY` permanently: leaves migrations non-canonical.

## lesson_plans

Fresh install SQL plan:

- Create the pre-202602 base table only with columns verified before later migrations.
- Enable RLS.
- Create owner insert/select policies.
- Replay existing migrations in order to add `curriculum_type`, `chapter`, update policy, `curriculum_framework`, and delete policy.

Existing DB reconciliation plan:

- If absent, create table and policies only in an explicitly approved reconciliation migration.
- If present, inspect columns, constraints, RLS, and policy expressions first.
- Add missing columns only with safe defaults.
- Do not drop/recreate table.
- Do not replace policies without security review.

Preconditions:

- Catalog inspection from local/test/staging or read-only production dump.
- Supabase migration-history behavior documented for the target environment.
- Explicit decision on old baseline file vs forward reconciliation file.

Postconditions:

- Fresh migration path can create `lesson_plans`.
- Existing database data is preserved.
- Owner RLS still requires `auth.uid() = user_id`.

Rollback considerations:

- Table creation rollback is not safe after writes; rollback should be backup/restore or compensating migration.
- Policy rollback must restore previous policy text captured during inspection.

Unknown items:

- Deployed extra columns/indexes/grants/triggers.
- Whether current deployed policies differ in name or expression.

## saved_lessons

Fresh install SQL plan:

- Create base table with app-required fields: `id`, `user_id`, `subject`, `grade`, `topic`, `curriculum`, `lesson_content`, `ppt_content`, `created_at`.
- Add owner RLS once exact policy names/expressions are confirmed.
- Replay existing migrations for `learning_objectives`, `chapter`, and moderation fields.

Existing DB reconciliation plan:

- If absent, do not create in production without a data-loss impact review because the feature is user-library critical.
- If present, add only verified missing columns with defaults matching later migrations.
- Preserve unknown extra columns/indexes.
- Keep `chapter` compatibility fallbacks until every environment is verified.

Safety checks:

- Verify browser direct-access RLS before any cutover.
- Confirm delete policy cannot delete another user's rows.
- Confirm super-admin moderation still has intended service-role access.

Unknown items:

- Base create-table SQL, policy names, indexes, and exact defaults.
- Whether moderation routes expect soft-delete filtering beyond existing code.

Checkpoint 25 update: a fresh-baseline reconciliation migration now
creates the app-required base table and owner RLS before the existing
`saved_lessons` alter migrations run. This is verified for local reset,
but production/staging catalog policy names and extra indexes remain
uninspected.

## school_templates

Fresh install SQL plan:

- Create table from embedded/current route contract, including `file_data`.
- Add `unique(user_id)` before upload upsert is considered stable.
- Enable RLS and create `"Users manage own template"` or reviewed equivalent owner policies.

Existing DB reconciliation plan:

- Inspect whether table exists and whether `file_data`/`logo_base64` already exist.
- Add missing nullable `logo_base64`/`file_data` columns only after review.
- Do not replace the existing manage-own policy without comparing expressions.
- Retain route-side manual ALTER error message until canonical migration is verified in all environments.

Safety checks:

- Confirm callers use bearer auth and anon key, not service role.
- Confirm RLS allows only the owner to select/upsert/delete.
- Confirm unique user constraint exists before relying on `onConflict: "user_id"`.

Unknown items:

- Whether production/staging ever applied the embedded SQL manually.
- Whether `file_data` exists in all environments.

## SQL Idempotency Review

`CREATE TABLE IF NOT EXISTS` is insufficient as a safety guarantee. It only protects object existence and does not prove columns, constraints, RLS, indexes, or policy text match.

`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe only when the intended type/default/nullability are compatible with existing data. A `not null` column should have a safe default or a staged backfill.

`CREATE POLICY` is not universally usable with `IF NOT EXISTS`. `DROP POLICY IF EXISTS` plus `CREATE POLICY` is repeatable, but it can silently change production security. Policy replacement requires catalog evidence and explicit review.

## Cutover Readiness Matrix

| Endpoint | Python parity | DB dependency | Auth dependency | Live integration required | Cutover blocker |
| --- | --- | --- | --- | --- | --- |
| `GET /api/geo` | Yes | None | None | No | None known; no traffic moved yet |
| `POST /api/lesson-plan/save` | Yes | `lesson_plans` + owner RLS | Bearer token/Supabase Auth | Yes | safe RLS environment and schema reproducibility |
| `POST /api/lesson-plan` | No cutover parity | `user_usage`, `generation_events`, provider calls, streaming | Bearer token/session | Yes | quota, streaming, AI payload parity |
| `POST /api/question-paper` | Not promoted | `user_usage`, `question_paper_generations`, provider calls | Bearer token/session | Yes | quota, AI payload parity, persistence |
| `POST /api/razorpay/webhook` | No | billing tables | Razorpay signature, service-role writes | Yes | money-impacting webhook replay/idempotency |

Lesson-plan save being blocked does not block public/non-DB Python work such as `GET /api/geo`.

## Checkpoint 23: `lesson_plans` Plan Executed (SQL Written, Not Applied)

The `lesson_plans` fresh-install plan above is now implemented exactly as
specified: `supabase/migrations/20260101000000_lesson_plans_baseline_reconciliation.sql`
creates the pre-202602 base table + RLS + insert/select policies, guarded
by a single `information_schema.tables` existence check so it is a
complete no-op wherever the table already exists — satisfying "if
present, inspect columns... do not drop/recreate table... do not replace
policies without security review" by simply not touching an existing
table at all. Static regression:
`backend-python/tests/test_supabase_schema_contract.py::test_lesson_plans_baseline_reconciliation_migration_matches_schema_contract`
proves this migration's SQL fragments match `schema.sql`'s verified
`lesson_plans` contract, so the two sources cannot silently diverge.

**Not applied to any database.** No Supabase CLI, Docker, or
positively-classified non-production Supabase target was available this
checkpoint. `saved_lessons` and `school_templates` plans above remain
exactly as specified — not implemented, still blocked on catalog
inspection this checkpoint could not safely perform.

## Next Safe Step

Run read-only catalog inspection against a classified non-production database or an approved production schema dump. Then create either:

- an early baseline used only for fresh bootstrap plus clear existing-environment handling, or
- a forward reconciliation migration that conditionally establishes missing objects with explicit catalog checks.

For `lesson_plans` specifically, the next safe step is narrower: obtain a
`LOCAL_DISPOSABLE`/`TEST`/`STAGING` Supabase target (Docker install, or a
dedicated hosted test project) and run the already-written migration plus
the already-written guarded integration harness — no further planning or
SQL authoring is needed for this one table.
