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

-- One active login per account (see supabase/migrations/20260519120000_active_sessions.sql)
create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,
  created_at timestamptz not null default now(),
  device_info text not null default ''
);

alter table public.active_sessions enable row level security;

drop policy if exists "Users can view own active session" on public.active_sessions;
create policy "Users can view own active session"
  on public.active_sessions for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own active session" on public.active_sessions;
create policy "Users can insert own active session"
  on public.active_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own active session" on public.active_sessions;
create policy "Users can update own active session"
  on public.active_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own active session" on public.active_sessions;
create policy "Users can delete own active session"
  on public.active_sessions for delete using (auth.uid() = user_id);

create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_type text not null default 'free',
  generations_used integer not null default 0,
  generations_limit integer not null default 3,
  reset_date date not null default (date_trunc('month', now())::date),
  created_at timestamptz not null default now()
);

alter table public.user_usage enable row level security;

drop policy if exists "Users can view own usage" on public.user_usage;
create policy "Users can view own usage"
  on public.user_usage for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.user_usage;
create policy "Users can insert own usage"
  on public.user_usage for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.user_usage;
create policy "Users can update own usage"
  on public.user_usage for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
