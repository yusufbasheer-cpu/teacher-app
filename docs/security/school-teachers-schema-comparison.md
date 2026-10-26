# `public.school_teachers` — staging vs production schema comparison (metadata only)

**Scope and method.** Read-only catalog / `information_schema` queries for the single table `public.school_teachers`, as authorised. **No rows, no auth tables, no credentials, no other tables** were read on production; nothing was written or migrated. Production identity was verified independently of the CLI: the live production site `www.layah.in` ships a client bundle that points at exactly `jbwevzvtloahjoamwnjt`, and the Management API names that ref "teacher-app Project" (Postgres 17.6.1.121, ap-northeast-1; staging is 17.6.1.166, ap-northeast-2). The production queries were run by a locked runner with **four fixed statements and no SQL input**:

1. `select to_regclass('public.school_teachers') is not null …`
2. `information_schema.columns` for the table
3. `pg_constraint` where `conrelid = to_regclass('public.school_teachers')`
4. `pg_indexes` for the table

*Side effect to disclose:* to run any SQL, the Supabase CLI creates a short-lived database login role (`cli_login_postgres`, minutes-long validity) through the Management API — on production as on staging. No schema, policy or data was modified.

## Columns

| Column | Staging (`esqnyktumxscyvznftlc`) | Production (`jbwevzvtloahjoamwnjt`) |
|---|---|---|
| `id` | uuid NOT NULL, default `gen_random_uuid()` | same |
| **FK to `school_accounts`** | **`school_account_id`** uuid **NOT NULL** | **`school_id`** uuid **NULL** |
| `user_id` | uuid NOT NULL | uuid **NULL** |
| `email` | text NOT NULL | text **NULL** |
| `joined_at` | timestamptz NOT NULL, default `now()` | timestamp **without** time zone NULL, default `now()` |
| `generations_used_this_month` | integer NOT NULL default 0 | **absent** |
| `role` | text NOT NULL default `'teacher'` | text **NULL** default `'teacher'` |
| `department` | text NULL | text NULL |

## Constraints and indexes

| | Staging | Production |
|---|---|---|
| Primary key | `(id)` | `(id)` |
| FK to schools | `school_teachers_school_account_id_fkey (school_account_id) → school_accounts(id) ON DELETE CASCADE` | `school_teachers_school_id_fkey (school_id) → school_accounts(id) ON DELETE CASCADE` |
| FK to users | `(user_id) → auth.users(id) ON DELETE CASCADE` | same |
| Uniqueness | **`UNIQUE (user_id)`** (one school per user) | **`UNIQUE (school_id, user_id)`** only |
| CHECKs | `role IN ('teacher','hod','admin')`; `generations_used_this_month >= 0` | none |
| Indexes | pkey, `school_teachers_user_id_key`, `school_teachers_school_account_id_idx` | pkey, `school_teachers_school_id_user_id_key` |

## What this means

- **Staging matches the repository migrations** (`20260524143000`, `20260528120000`, `20260613130000`). **Production does not**: the repo's `create table if not exists` was evidently a no-op there (the table pre-dated it), and the later migrations that add `generations_used_this_month`, the role/usage CHECKs and the user-unique constraint are not reflected.
- **The application code matches neither environment completely.** It uses the production FK name (`school_id`) but also needs `generations_used_this_month` (HOD dashboard, enrollment sync, super-admin school view) and upserts with `onConflict: "user_id"`, which requires `UNIQUE (user_id)`. On production the `onConflict` upsert has no matching constraint and the usage column does not exist, so **parts of school enrollment and the HOD/usage views cannot work there either** (this is inferred from schema metadata and code; no production behaviour or data was observed).
- Whether production even contains the wildcard policy removed on staging by Phase 2 (its repo definition references `school_account_id`, which production lacks) is **unknown**: production policies were out of scope and not read.

## F5 compatibility decision

**Contract of record: the repository-migration schema — FK column `school_account_id`, `UNIQUE (user_id)`, `generations_used_this_month`, with the role/usage CHECKs.**
Reasons: (1) it is the only schema under which every code path (FK column, usage column, upsert conflict target) is actually satisfiable; (2) it is what a fresh environment builds from `supabase/migrations`; (3) the name is unambiguous. Standardising on production's `school_id` instead would still leave the usage column and unique constraint missing and would need a staging rename plus extra columns — more change, same drift.

- **Staging code:** keep commit `ff87bfd` (DB-column references → `school_account_id`; the auth `user_metadata.school_id` key is deliberately unchanged). Typecheck, 741 tests, lint, build green.
- **Production is behind the contract and must be migrated before this code can ever run there.** `ff87bfd` **would break production school queries if merged to `main` or deployed to production first.** It is staging-only until production is aligned.
- **No duplicate column was added**, no compatibility shim, no production change.

## Production alignment — DRAFT ONLY (not approved, not run, not in `supabase/migrations`)

Preconditions to verify first, each needing separate approval because they read production data: row count of `school_teachers`; rows with NULL `user_id`/`email`/`school_id`; users appearing in more than one school (would block `UNIQUE (user_id)`); which policies exist on the table.

```sql
-- DRAFT: data-preserving, guarded, idempotent. Review with real row counts before any use.
alter table public.school_teachers rename column school_id to school_account_id;
alter table public.school_teachers rename constraint school_teachers_school_id_fkey to school_teachers_school_account_id_fkey;
alter index  public.school_teachers_school_id_user_id_key rename to school_teachers_school_account_id_user_id_key;
alter table public.school_teachers add column if not exists generations_used_this_month integer not null default 0;
-- only after confirming no NULLs / duplicates:
--   alter table public.school_teachers alter column user_id set not null, alter column email set not null, alter column school_account_id set not null;
--   alter table public.school_teachers add constraint school_teachers_user_id_key unique (user_id);
--   add the role and usage CHECK constraints; convert joined_at to timestamptz.
```

## Merge guard
Until production is aligned: do **not** merge `release/unified-staging` / `staging` into `main`, and do not deploy any build containing `ff87bfd` to production.
