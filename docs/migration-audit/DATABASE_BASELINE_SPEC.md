# Database Baseline Spec

Date: 2026-09-01

Purpose: describe the intended baseline required before historical forward migrations run for objects missing from canonical migration history.

Status: `REVIEWED_SPECIFICATION_NOT_EXECUTABLE_MIGRATION`.

## Ordering Model

The baseline must be split from existing-database reconciliation.

Fresh database bootstrap target:

```text
baseline for pre-existing objects
  -> existing ordered migrations
  -> current intended schema
```

Existing database upgrade target:

```text
inspect existing catalog state
  -> apply only non-destructive missing pieces
  -> preserve user data and unknown extra schema
```

Do not add a newly old-dated migration casually. Supabase records applied migration versions; an existing hosted project may already have later migration versions recorded. A new file dated before those versions can be confusing or skipped/require repair depending on the migration workflow. The safer repository model is either a documented bootstrap snapshot for fresh environments or a new forward reconciliation migration after catalog inspection.

## lesson_plans Baseline

Fresh baseline should represent the table as it existed before later tracked migrations changed it.

Supported pre-202602 baseline:

```sql
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  grade text not null,
  topic text not null,
  learning_objectives text not null,
  lesson_plan jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.lesson_plans enable row level security;

create policy "Users can insert their own lesson plans"
  on public.lesson_plans
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own lesson plans"
  on public.lesson_plans
  for select
  using (auth.uid() = user_id);
```

Later migration replay:

| Migration | Expected effect on baseline |
| --- | --- |
| `20260210120000_lesson_plans_curriculum_chapter.sql` | Adds `curriculum_type`, `chapter`, and update owner policy. |
| `20260511120000_lesson_plans_curriculum_framework.sql` | Adds `curriculum_framework`. |
| `20260604120000_lesson_plans_delete_policy.sql` | Adds delete owner policy. |

Current intended result after replay:

- columns from `supabase/schema.sql`
- owner insert/select/update/delete policies
- no tracked secondary index, trigger, or custom function

Confidence: `VERIFIED` for repository-intended shape.

## saved_lessons Baseline

Fresh baseline must create the base user library table before later migrations add objectives, chapter, and moderation fields.

Supported base fields from application usage:

| Column | Type | Nullability/default | Evidence |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, likely `default gen_random_uuid()` | common Supabase pattern; app expects string id |
| `user_id` | `uuid` | not null, likely `references auth.users(id) on delete cascade` | browser filters and ownership semantics |
| `subject` | `text` | required by app | insert/list/view |
| `grade` | `text` | required by app | insert/list/view |
| `topic` | `text` | required by app | insert/list/view |
| `curriculum` | `text` | required by app | insert/list/view |
| `lesson_content` | `text` | required by app | serialized lesson package |
| `ppt_content` | `text` | required by app | PPT section text |
| `created_at` | `timestamptz` | app supplies ISO timestamp; DB default unknown | insert/order |

Later migration replay:

| Migration | Expected effect on baseline |
| --- | --- |
| `20260610120000_saved_lessons_learning_objectives.sql` | Adds `learning_objectives text not null default ''`. |
| `20260825140000_saved_lessons_chapter.sql` | Adds `chapter text not null default ''`. |
| `20260825180000_content_moderation.sql` | Adds `flagged`, `flagged_reason`, `flagged_by`, `deleted_at`. |

RLS baseline:

- Intended owner read/write/delete is required because browser clients access the table directly with authenticated Supabase sessions.
- Exact tracked policy text is unavailable.
- Do not create or replace policies until a deployed/test catalog confirms current policy names and expressions.

Confidence: `PARTIAL`. The app contract is clear; the exact original SQL is not.

## school_templates Baseline

Fresh baseline must move the embedded route/comment contract into canonical SQL later.

Supported current fields:

| Column | Type | Nullability/default | Evidence |
| --- | --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` | embedded SQL |
| `user_id` | `uuid` | not null, `references auth.users(id) on delete cascade` | embedded SQL and route filters |
| `original_filename` | `text` | not null | embedded SQL and upload route |
| `thumbnail_base64` | `text` | nullable | embedded SQL and GET route |
| `primary_color` | `text` | not null default `'1B3A6B'` | embedded SQL |
| `accent_color` | `text` | not null default `'F5A623'` | embedded SQL |
| `background_color` | `text` | not null default `'FFFFFF'` | embedded SQL |
| `dark_color` | `text` | not null default `'0A1628'` | embedded SQL |
| `font_heading` | `text` | not null default `'Calibri'` | embedded SQL |
| `font_body` | `text` | not null default `'Calibri'` | embedded SQL |
| `logo_base64` | `text` | nullable | embedded SQL plus upload fallback |
| `file_data` | `text` | nullable | upload route and runtime fallback; missing from embedded create-table comment |
| `created_at` | `timestamptz` | `default now()` | embedded SQL and GET route |

Constraints and RLS:

- `unique(user_id)` is required by upload `upsert(..., { onConflict: "user_id" })`.
- Embedded SQL uses one all-command policy: `"Users manage own template"` with `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.
- RLS is intended to be enabled.

Runtime DDL debt:

- Route: `POST /api/school-template/upload`.
- Condition: Supabase upsert fails with a missing-column error mentioning `logo_base64` or `file_data`.
- Credentials/context: caller-context Supabase client using the request bearer token and anon key.
- ALTER attempted: none executed by code. The route returns a 500 JSON error containing manual SQL for `ALTER TABLE school_templates ADD COLUMN IF NOT EXISTS logo_base64 TEXT;` and `ALTER TABLE school_templates ADD COLUMN IF NOT EXISTS file_data TEXT;`.
- Classification: `MIGRATION_DEBT`. It is a compatibility message, not an authoritative migration path.
- Retain during migration until canonical migration has been applied and verified in every environment.

Confidence: `PARTIAL`. The current application contract is clear, but `file_data` is not in the original embedded create-table block and no live catalog has been inspected.

## Future schema.sql Rule

After reconciliation:

- ordered migrations are canonical
- `supabase/schema.sql` is generated or reviewed from the canonical current schema
- no new table, column, policy, index, trigger, or function may originate only in `schema.sql`
- route fallback SQL/comments may describe operational recovery, but cannot be the source of truth
