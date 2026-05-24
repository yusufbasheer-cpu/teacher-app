-- Allow school admins (admin_email) to read and manage their school via RLS.

drop policy if exists "School admins read own school account" on public.school_accounts;
create policy "School admins read own school account"
  on public.school_accounts for select
  to authenticated
  using (
    lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "School admins read school teachers" on public.school_teachers;
create policy "School admins read school teachers"
  on public.school_teachers for select
  to authenticated
  using (
    school_account_id in (
      select id from public.school_accounts
      where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "School admins delete school teachers" on public.school_teachers;
create policy "School admins delete school teachers"
  on public.school_teachers for delete
  to authenticated
  using (
    school_account_id in (
      select id from public.school_accounts
      where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

grant select on table public.school_accounts to authenticated;
grant select, delete on table public.school_teachers to authenticated;
