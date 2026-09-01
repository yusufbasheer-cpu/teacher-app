-- Baseline reconciliation for public.lesson_plans (Checkpoint 23).
--
-- Context: `public.lesson_plans` has existed in `supabase/schema.sql` since
-- the first commit, but no migration in this directory creates it — the
-- earliest tracked migration (20260210120000_lesson_plans_curriculum_chapter)
-- already assumes the table exists. A fresh `supabase migration up` /
-- `supabase db reset` therefore cannot reproduce `lesson_plans` today.
-- See docs/migration-audit/DATABASE_SOURCE_OF_TRUTH.md,
-- SCHEMA_RECONCILIATION_MATRIX.md, DATABASE_BASELINE_SPEC.md, and
-- SUPABASE_SCHEMA_DRIFT.md for the full investigation this migration
-- implements.
--
-- Dated 2026-01-01 (before 20260210120000) so a fresh bootstrap creates
-- this table before the later ALTER-style migrations run against it.
--
-- SAFE ON A FRESH DATABASE: creates the table exactly as documented in
-- DATABASE_BASELINE_SPEC.md's verified pre-202602 shape (RLS enabled,
-- original owner insert/select policies only — the later migrations
-- listed above add curriculum_type, chapter, the update policy,
-- curriculum_framework, and the delete policy on top of this baseline).
--
-- SAFE ON AN EXISTING DATABASE WHERE lesson_plans ALREADY EXISTS
-- (e.g. any currently deployed environment): this migration is a
-- complete no-op. It does not inspect, alter, add columns to, or
-- replace any policy on an existing table. Per
-- docs/migration-audit/SCHEMA_RECONCILIATION_PLAN.md's "SQL Idempotency
-- Review", policy replacement requires catalog evidence this repository
-- does not have for any hosted environment, so this migration
-- deliberately does not attempt it.
--
-- NOT YET APPLIED OR TESTED against any live database as of Checkpoint 23
-- — no Supabase CLI, no Docker, and no positively-classified
-- non-production Supabase target were available in that session. Before
-- running this against any real environment (local or hosted), read
-- docs/migration-audit/LOCAL_SUPABASE_TESTING.md and
-- docs/migration-audit/FASTAPI_RLS_INTEGRATION.md.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'lesson_plans'
  ) then
    create table public.lesson_plans (
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
  end if;
end;
$$;
