-- Widen admin_roles for a second, narrower 'admin' role (in addition to the
-- existing 'super_admin'), and add admin_permissions for per-permission
-- grants to that narrower role (e.g. an admin without 'billing.refund').
--
-- The CHECK constraint on admin_roles.role was never explicitly named in
-- its original migration (20260531120000_admin_roles.sql), so this looks
-- it up dynamically via pg_constraint rather than assuming a name.
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'admin_roles'
    and con.contype = 'c'
    and att.attname = 'role';

  if v_constraint_name is not null then
    execute format('alter table public.admin_roles drop constraint %I', v_constraint_name);
  end if;

  alter table public.admin_roles
    add constraint admin_roles_role_check check (role in ('super_admin', 'admin'));
end $$;

-- Permission strings are validated in application code (src/lib/super-admin.ts's
-- AdminPermission TS union), not a DB CHECK — same convention as AuditAction in
-- audit-log.ts, so adding a new permission never needs a migration.
create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  unique (user_id, permission)
);

-- Service-role only, no client policies — same convention as admin_roles.
alter table public.admin_permissions enable row level security;
