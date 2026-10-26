-- ============================================================================
-- Security Phase 2b (F8) — break the recursive school RLS policies.
--
-- ROOT CAUSE (verified against the live staging catalog):
--   school_accounts "Teachers read own school account"   → subquery on school_teachers
--   school_teachers "School admins read school teachers" → subquery on school_accounts
--   school_teachers "School admins delete school teachers" → subquery on school_accounts
-- Evaluating either table's RLS therefore re-enters the other, and every `authenticated`
-- read of school_accounts or school_teachers fails with 42P17 "infinite recursion detected in
-- policy". It fails CLOSED (an error, no data exposed) and the app is unaffected because it uses the
-- service role, but client-side school isolation could not work or be tested.
--
-- FIX (one edge of the cycle, nothing else):
--   public.admin_school_account_ids() — an ARGUMENT-LESS SECURITY DEFINER helper returning only the
--   ids of schools whose admin_email equals the CALLER'S OWN JWT email (case-insensitive equality; no
--   LIKE/ILIKE, so '_' and '%' are literal). The two school_teachers admin policies call it instead of
--   subquerying school_accounts, so school_teachers' policies no longer touch school_accounts' RLS.
--
-- WHY THIS HELPER IS SAFE (reviewed, not assumed):
--   * No parameters → no caller-chosen id → nothing to enumerate; it can only ever answer "which
--     schools do I administer", which the caller can already read through "School admins read own
--     school account".
--   * Returns ids only (uuid), never rows or columns of private data.
--   * `set search_path = ''` and every relation is schema-qualified; no function/operator in the body
--     can be hijacked through the caller's search_path.
--   * Owned by postgres (BYPASSRLS, table owner, RLS not forced), so it reads school_accounts without
--     re-entering policies — which is exactly what removes the recursion.
--   * EXECUTE: revoked from PUBLIC and anon; granted to authenticated (policies are evaluated with the
--     invoking role's EXECUTE privilege) and service_role. Membership/removal is still decided live
--     from school_teachers and admin_email, so a removed member or a replaced admin loses access at
--     once.
--   * No policy becomes more permissive: the predicate is semantically identical to the old subquery
--     (same table, same lower() equality, same JWT email).
--
-- Idempotent: create or replace; policies altered only if present. No data is read or changed.
--
-- ROLLBACK (restores the recursion F8 — only if a legitimate flow breaks):
--   alter policy "School admins read school teachers" on public.school_teachers
--     using (school_account_id in (select id from public.school_accounts where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
--   alter policy "School admins delete school teachers" on public.school_teachers
--     using (school_account_id in (select id from public.school_accounts where lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
--   drop function public.admin_school_account_ids();
-- ============================================================================

create or replace function public.admin_school_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sa.id
  from public.school_accounts sa
  where lower(sa.admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

alter function public.admin_school_account_ids() owner to postgres;

revoke all on function public.admin_school_account_ids() from public, anon, authenticated;
grant execute on function public.admin_school_account_ids() to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_teachers' and policyname = 'School admins read school teachers') then
    alter policy "School admins read school teachers" on public.school_teachers
      using (school_account_id in (select public.admin_school_account_ids()));
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_teachers' and policyname = 'School admins delete school teachers') then
    alter policy "School admins delete school teachers" on public.school_teachers
      using (school_account_id in (select public.admin_school_account_ids()));
  end if;
end;
$$;

-- ============================================================================
-- VERIFY (expected after applying):
--   select proname, prosecdef, proconfig, has_function_privilege('anon', oid, 'execute') as anon_exec
--     from pg_proc where oid = 'public.admin_school_account_ids()'::regprocedure;   -- true, {search_path=""}, false
--   select policyname, qual from pg_policies where tablename = 'school_teachers';   -- admin policies call the helper
--   (and the isolation test: scripts/security/phase-2b-school-rls-test.sql)
-- ============================================================================
