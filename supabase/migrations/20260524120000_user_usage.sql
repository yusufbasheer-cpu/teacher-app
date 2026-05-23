create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_type text not null default 'free'
    check (plan_type in ('free', 'pro', 'pro_plus', 'school_starter', 'school_pro', 'school_enterprise')),
  generations_used integer not null default 0 check (generations_used >= 0),
  generations_limit integer not null default 3 check (generations_limit >= -1),
  reset_date date not null default (date_trunc('month', now())::date),
  created_at timestamptz not null default now()
);

create index if not exists user_usage_reset_date_idx on public.user_usage (reset_date);

alter table public.user_usage enable row level security;

drop policy if exists "Users can view own usage" on public.user_usage;
create policy "Users can view own usage"
  on public.user_usage for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.user_usage;
create policy "Users can insert own usage"
  on public.user_usage for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.user_usage;
create policy "Users can update own usage"
  on public.user_usage for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
