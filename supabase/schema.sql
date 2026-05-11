create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_type text not null default 'Other',
  subject text not null,
  grade text not null,
  chapter text not null default '',
  curriculum_framework text not null default '',
  topic text not null,
  learning_objectives text not null,
  lesson_plan jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.lesson_plans enable row level security;

drop policy if exists "Users can insert their own lesson plans" on public.lesson_plans;
create policy "Users can insert their own lesson plans"
  on public.lesson_plans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own lesson plans" on public.lesson_plans;
create policy "Users can view their own lesson plans"
  on public.lesson_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own lesson plans" on public.lesson_plans;
create policy "Users can update their own lesson plans"
  on public.lesson_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
