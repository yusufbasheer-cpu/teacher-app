-- audit_logs: immutable record of all admin actions
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- No RLS policies — only accessible via service role key
alter table public.audit_logs enable row level security;

create index if not exists audit_logs_admin_user_idx on public.audit_logs (admin_user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
