-- Add a second super_admin (account owner, alongside the original founder seed
-- in 20260531120000_admin_roles.sql). Matches the email allowlist in
-- src/lib/super-admin.ts (SUPER_ADMIN_EMAILS).
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'uvaissolanki506@gmail.com'
  limit 1;

  if v_user_id is not null then
    insert into public.admin_roles (user_id, role)
    values (v_user_id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
end $$;
