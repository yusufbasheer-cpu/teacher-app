-- ============================================================================
-- Security Phase 2 — RPC grants and school_teachers write path.
--
-- 1. refund_user_generation(uuid, date) takes ANY user id and lowers that
--    user's used-generation count. 20260728120000 meant it to be service_role
--    only, but it ran `revoke ... from public`, which does not remove the
--    EXECUTE that Supabase's default privileges grant directly to anon and
--    authenticated on every new public function. If those grants exist, any
--    caller (even with only the public anon key) can refund any user's credits
--    and read their plan/usage row. Revoke them explicitly.
--
-- 2. The auth.uid()-scoped usage RPCs reject a NULL identity, but anon has no
--    reason to execute them. Least privilege: authenticated + service_role.
--
-- 3. "school_admin_update_teacher_role" matched admins with
--    `admin_email ILIKE <jwt email>`: the caller's own email is used as a LIKE
--    pattern, so "_" and "%" in it act as wildcards. The app never uses this
--    path (role/department changes go through /api/school-admin/teachers with
--    the service role after a verified-email school lookup), so the policy and
--    the UPDATE grant are removed instead of rewritten.
--
-- Every statement is guarded, so the migration is safe to re-run and safe on a
-- database where an object is missing. No data is read, changed or deleted.
--
-- ROLLBACK (only if a legitimate flow breaks):
--   grant execute on function public.refund_user_generation(uuid, date) to authenticated;   -- NOT recommended
--   grant execute on function public.ensure_user_usage() to anon;
--   grant update on table public.school_teachers to authenticated;
--   create policy "school_admin_update_teacher_role" on public.school_teachers for update
--     using (school_id in (select id from public.school_accounts where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
--     with check (school_id in (select id from public.school_accounts where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
-- ============================================================================

do $$
declare
  fn text;
begin
  -- 1. Service-role only.
  if to_regprocedure('public.refund_user_generation(uuid, date)') is not null then
    revoke all on function public.refund_user_generation(uuid, date) from public, anon, authenticated;
    grant execute on function public.refund_user_generation(uuid, date) to service_role;
  end if;

  -- 2. Signed-in callers only (each function acts on auth.uid() alone).
  foreach fn in array array[
    'public.ensure_user_usage()',
    'public.ensure_own_user_usage()',
    'public.consume_user_generation()',
    'public.increment_user_generations()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
    end if;
  end loop;

  -- 3. Remove the unused, wildcard-matching school admin write path.
  if to_regclass('public.school_teachers') is not null then
    drop policy if exists "school_admin_update_teacher_role" on public.school_teachers;
    revoke update on table public.school_teachers from anon, authenticated;
  end if;
end;
$$;

-- ============================================================================
-- VERIFY (expected: every row false):
--   select p.oid::regprocedure, r.rolname,
--          has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
--   from pg_proc p cross join (values ('anon'), ('authenticated')) r(rolname)
--   where p.oid = 'public.refund_user_generation(uuid, date)'::regprocedure;
--
--   select has_table_privilege('authenticated', 'public.school_teachers', 'update');
-- ============================================================================
