-- Account suspension, enforced at authenticateRequest() — the single choke
-- point every generation route already calls.
alter table public.user_usage add column if not exists account_status text not null default 'active';
alter table public.user_usage add column if not exists suspended_reason text;
alter table public.user_usage add column if not exists suspended_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_usage_account_status_check'
  ) then
    alter table public.user_usage
      add constraint user_usage_account_status_check check (account_status in ('active', 'suspended'));
  end if;
end $$;

-- Real-session-swap impersonation is powerful enough to warrant its own
-- audit shape beyond generic audit_logs.details — "who impersonated whom,
-- when" without parsing jsonb.
create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reason text,
  ip_address text,
  user_agent text
);
create index if not exists impersonation_sessions_target_idx on public.impersonation_sessions (target_user_id);
alter table public.impersonation_sessions enable row level security;
