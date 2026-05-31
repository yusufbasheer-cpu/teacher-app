-- admin_roles: database-backed super-admin role (replaces email-only check)
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Only accessible via service role key — no public RLS policies
alter table public.admin_roles enable row level security;

-- Seed the initial super-admin from auth.users by email
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'yusuf.basheer@gmail.com'
  limit 1;

  if v_user_id is not null then
    insert into public.admin_roles (user_id, role)
    values (v_user_id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
end $$;
