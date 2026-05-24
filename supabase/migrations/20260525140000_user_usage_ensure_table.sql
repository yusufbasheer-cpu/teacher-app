-- Ensure user_usage exists with id PK (product spec). Upgrade legacy user_id-PK tables.
create extension if not exists "pgcrypto";

create table if not exists public.user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_type text not null default 'free'
    check (plan_type in ('free', 'pro', 'pro_plus', 'school_starter', 'school_pro', 'school_enterprise')),
  generations_used integer not null default 0 check (generations_used >= 0),
  generations_limit integer not null default 3 check (generations_limit >= -1),
  reset_date date not null default ((date_trunc('month', now()) + interval '1 month')::date),
  created_at timestamptz not null default now()
);

-- Legacy table from 20260524120000_user_usage.sql (user_id was the primary key, no id column)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_usage'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_usage' and column_name = 'id'
  ) then
    alter table public.user_usage add column id uuid default gen_random_uuid();
    update public.user_usage set id = gen_random_uuid() where id is null;
    alter table public.user_usage alter column id set not null;
    alter table public.user_usage drop constraint if exists user_usage_pkey;
    alter table public.user_usage add primary key (id);
    create unique index if not exists user_usage_user_id_key on public.user_usage (user_id);
  end if;
end $$;

create index if not exists user_usage_reset_date_idx on public.user_usage (reset_date);
create index if not exists user_usage_user_id_idx on public.user_usage (user_id);

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
