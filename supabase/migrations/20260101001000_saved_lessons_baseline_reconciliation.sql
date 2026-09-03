-- Baseline reconciliation for public.saved_lessons (Checkpoint 25).
--
-- Context: later tracked migrations alter public.saved_lessons, but no
-- migration in this directory creates its base table. A fresh local
-- `supabase db reset` therefore fails before the authenticated
-- lesson-plan RLS harness can run.
--
-- This baseline is intentionally narrow: it creates only the base fields
-- required by current application usage before later migrations add
-- learning_objectives, chapter, and moderation columns.
--
-- SAFE ON A FRESH DATABASE: creates the app-required base table with
-- owner RLS for direct browser access.
--
-- SAFE ON AN EXISTING DATABASE WHERE saved_lessons ALREADY EXISTS: this
-- migration is a complete no-op. It does not alter columns or replace
-- policies on an existing table.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'saved_lessons'
  ) then
    create table public.saved_lessons (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      subject text not null,
      grade text not null,
      topic text not null,
      curriculum text not null,
      lesson_content text not null,
      ppt_content text not null,
      created_at timestamptz not null default now()
    );

    create index saved_lessons_user_created_idx
      on public.saved_lessons (user_id, created_at);

    alter table public.saved_lessons enable row level security;

    create policy "Users can insert their own saved lessons"
      on public.saved_lessons
      for insert
      with check (auth.uid() = user_id);

    create policy "Users can view their own saved lessons"
      on public.saved_lessons
      for select
      using (auth.uid() = user_id);

    create policy "Users can update their own saved lessons"
      on public.saved_lessons
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);

    create policy "Users can delete their own saved lessons"
      on public.saved_lessons
      for delete
      using (auth.uid() = user_id);
  end if;
end;
$$;
