# Schema Reconciliation Matrix

Date: 2026-09-01

Scope: `lesson_plans`, `saved_lessons`, `school_templates`, and their direct dependencies only.

Current conclusion: `DOCUMENTATION_ONLY_FOR_CHECKPOINT_13`. No executable migration SQL is created because fresh-database bootstrap and existing-database upgrade safety are not the same problem, and the live state of existing environments has not been inspected.

## Summary

| Object | Current definition source | Base migration exists? | Fresh migration sequence creates it? | Existing DB risk | Confidence |
| --- | --- | --- | --- | --- | --- |
| `public.lesson_plans` | `supabase/schema.sql`; later alter/policy migrations; app/API tests | No | No | Medium: security policy replacement could change RLS behavior | Verified for intended shape; unknown for deployed extras |
| `public.saved_lessons` | app readers/writers; later alter migrations | Yes, Checkpoint 25 fresh baseline | Yes, local reset | High: user library data, moderation columns, and live `chapter` fallback | Local reset verified; hosted catalog still uninspected |
| `public.school_templates` | `src/lib/pptx-template.ts` embedded SQL; school-template API routes; upload fallback message | No | No | High: table is user-owned, stores uploaded file data, and schema is not in migrations | Partial |

## lesson_plans

| Field | Finding |
| --- | --- |
| Object | `public.lesson_plans` |
| Current definition source | `supabase/schema.sql`; `src/lib/lesson-plan-save.ts`; Python parity service/tests; later migrations `20260210120000`, `20260511120000`, `20260604120000` |
| Base migration exists? | No |
| Application readers | `src/app/api/account/export/route.ts`; lesson view/generator flows; Python integration harness reads through PostgREST |
| Application writers | `src/lib/lesson-plan-save.ts`; legacy browser callers still visible in some components for related save actions |
| RLS enabled? | Yes in `schema.sql` |
| Select policy | `"Users can view their own lesson plans"`: `USING (auth.uid() = user_id)` |
| Insert policy | `"Users can insert their own lesson plans"`: `WITH CHECK (auth.uid() = user_id)` |
| Update policy | `"Users can update their own lesson plans"`: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| Delete policy | `"Users can delete their own lesson plans"`: `USING (auth.uid() = user_id)` |
| Indexes | No secondary table indexes found in tracked SQL |
| Foreign keys | `user_id uuid not null references auth.users(id) on delete cascade` |
| Defaults | `id default gen_random_uuid()`, `curriculum_type default 'Other'`, `chapter default ''`, `curriculum_framework default ''`, `created_at default now()` |
| Triggers | None found |
| Functions | Uses Supabase/Postgres functions `gen_random_uuid()` and `auth.uid()` |
| Other dependencies | Supabase Auth, PostgREST authenticated role/claims |
| Fresh-DB requirement | A canonical baseline must create the original pre-202602 table before later migrations add `curriculum_type`, `chapter`, `curriculum_framework`, and delete policy |
| Existing-DB risk | A reconciliation migration must not drop data or silently replace existing policies without catalog review |
| Confidence | Verified for repository-intended contract; existing deployed drift unknown |

## saved_lessons

| Field | Finding |
| --- | --- |
| Object | `public.saved_lessons` |
| Current definition source | browser auto-save/list/view/delete code; HOD/admin reads; migrations `20260610120000`, `20260825140000`, `20260825180000` |
| Base migration exists? | No |
| Application readers | `workspace.tsx`, `dashboard-overview.tsx`, `command-palette.tsx`, `my-lesson-plans-list.tsx`, `lesson-view.tsx`, `hod-server.ts`, super-admin moderation through `CONTENT_TABLE_BY_TYPE` |
| Application writers | `lesson-plan-generator.tsx` insert; `my-lesson-plans-list.tsx` delete; moderation/admin code may update moderation columns through content routes |
| RLS enabled? | Intended but not verified in tracked executable SQL |
| Select policy | Intended owner-read for browser clients; exact policy text unknown |
| Insert policy | Intended owner-insert for browser auto-save; exact policy text unknown |
| Update policy | Required for moderation/admin updates or user edits if exposed; exact policy text unknown |
| Delete policy | Required for user delete by `id` and `user_id`; exact policy text unknown |
| Indexes | Unknown; no tracked base/index migration found |
| Foreign keys | `user_id -> auth.users(id)` is strongly implied by ownership usage; `flagged_by references auth.users(id)` is present in migration `20260825180000` |
| Defaults | Later migrations verify `learning_objectives default ''`, `chapter default ''`, `flagged default false`; base defaults unknown except application provides `created_at` |
| Triggers | None found |
| Functions | Uses Supabase `auth.uid()` if owner RLS exists; no custom function found |
| Other dependencies | Supabase Auth, browser Supabase client, service-role admin reads for HOD/moderation |
| Fresh-DB requirement | A baseline must create base user library columns before later migrations add `learning_objectives`, `chapter`, and moderation fields |
| Existing-DB risk | High: user library data is critical, `chapter` has runtime compatibility fallback, and exact existing RLS/indexes are unverified |
| Confidence | Partial |

## school_templates

| Field | Finding |
| --- | --- |
| Object | `public.school_templates` |
| Current definition source | SQL comment in `src/lib/pptx-template.ts`; `src/app/api/school-template/route.ts`; `src/app/api/school-template/upload/route.ts` |
| Base migration exists? | No |
| Application readers | `GET /api/school-template` selects template metadata/design fields; PPT rendering consumes template record fields |
| Application writers | `POST /api/school-template/upload` upserts; `DELETE /api/school-template` deletes |
| RLS enabled? | Intended by embedded SQL: `ALTER TABLE school_templates ENABLE ROW LEVEL SECURITY` |
| Select policy | Covered by single `"Users manage own template"` all-command policy in embedded SQL, not a dedicated select policy |
| Insert policy | Same all-command policy with `WITH CHECK (auth.uid() = user_id)` |
| Update policy | Same all-command policy with `USING` and `WITH CHECK`; upsert depends on it |
| Delete policy | Same all-command policy with `USING (auth.uid() = user_id)` |
| Indexes | Unique constraint on `user_id`; no separate indexes found |
| Foreign keys | `user_id uuid references auth.users(id) on delete cascade not null` |
| Defaults | `id default gen_random_uuid()`, colors/fonts defaults, `created_at default now()` |
| Triggers | None found |
| Functions | Uses `gen_random_uuid()` and `auth.uid()` |
| Other dependencies | Uploaded `.pptx` parsing; base64 file storage in `file_data`; Supabase Auth caller token |
| Fresh-DB requirement | A canonical migration must create table, unique user ownership, RLS, and current columns including `logo_base64` and `file_data` before routes can be relied on |
| Existing-DB risk | High: route can fail and return manual DDL instructions for missing columns; replacing the policy could alter user access |
| Confidence | Partial: app/comment contract clear, deployed application state unknown |

## Direct Dependencies

| Dependency | Objects | Purpose |
| --- | --- | --- |
| `auth.users` | all three | User ownership foreign keys |
| `auth.uid()` | all three | Owner RLS policies |
| `gen_random_uuid()` | `lesson_plans`, `school_templates`; likely `saved_lessons` | UUID primary key defaults |
| PostgREST authenticated request context | all browser/caller-token paths | Applies Supabase RLS from bearer token |
| Service-role client | `saved_lessons` HOD/moderation reads; test fixtures | Server-only administrative visibility, not browser authorization |

## Existing Database State Model

| State | Future reconciliation behavior |
| --- | --- |
| Object absent | Create table, constraints, RLS, and policies only when exact definition is verified and migration history ordering is chosen. |
| Object exists exactly as intended | Leave data and schema intact; verify catalog state before marking reconciled. |
| One expected column absent | Add only the missing nullable/defaulted column if backfill semantics are safe; never force incompatible `NOT NULL` without a default or data audit. |
| RLS/policies differ | Do not silently replace. Record current policy, compare with intended security contract, then use an approved policy migration. |
| Unknown extra columns/indexes | Preserve extras by default. Document drift and decide separately whether they are intentional environment-specific additions. |

## Reproducibility Check

| Object | Can current fresh migration sequence create it? | Status |
| --- | --- | --- |
| `lesson_plans` | Yes, as of Checkpoint 23 | `RECONCILIATION_SQL_WRITTEN_UNTESTED` — `20260101000000_lesson_plans_baseline_reconciliation.sql` added; not applied/tested against any live database (no safe target available) |
| `saved_lessons` | Yes, Checkpoint 25 | `LOCAL_RESET_VERIFIED_BASELINE_RECONCILED` — sufficient for fresh local reset; hosted catalog still needs inspection before production reconciliation |
| `school_templates` | No | `PLANNED_BUT_NOT_EXECUTABLE` — still `PARTIAL` confidence, deliberately deferred |
