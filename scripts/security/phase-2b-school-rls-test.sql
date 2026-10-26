-- Security Phase 2b (F8) — school RLS isolation test. ISOLATED STAGING ONLY (esqnyktumxscyvznftlc).
-- Executed by scripts/security/phase2-cli.mjs `school-test`, which wraps this file in a transaction that ALWAYS
-- ends in an aborting RAISE EXCEPTION (nothing persists). The file itself has no BEGIN/COMMIT/ROLLBACK.
-- Each test switches to anon/authenticated with forged JWT claims exactly as PostgREST does and records
-- PASS / FAIL in a temp table. A policy-evaluation error such as 42P17 (infinite recursion) is always a FAIL.
-- Fixtures: fixed UUIDs, *.invalid emails. Expect (-1) means "must be denied with 42501".

create temporary table r (test text primary key, verdict text not null, detail text not null default '') on commit drop;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('50000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'p2b-teacher-a1@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'p2b-teacher-a2@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'p2b-teacher-b1@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'p2b-admin-a@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'p2b-admin-b@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'p2b-removed@example.invalid', now(), now()),
  ('50000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'p2b-outsider@example.invalid', now(), now());

insert into public.school_accounts (id, school_name, admin_email, email_domain, max_teachers) values
  ('40000000-0000-4000-8000-0000000000a1', 'P2B School A', 'p2b-admin-a@example.invalid', 'p2ba.example.invalid', 5),
  ('40000000-0000-4000-8000-0000000000b2', 'P2B School B', 'p2b-admin-b@example.invalid', 'p2bb.example.invalid', 5);

insert into public.school_teachers (school_account_id, user_id, email) values
  ('40000000-0000-4000-8000-0000000000a1', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid'),
  ('40000000-0000-4000-8000-0000000000a1', '50000000-0000-4000-8000-0000000000a2', 'p2b-teacher-a2@example.invalid'),
  ('40000000-0000-4000-8000-0000000000b2', '50000000-0000-4000-8000-0000000000b1', 'p2b-teacher-b1@example.invalid'),
  ('40000000-0000-4000-8000-0000000000a1', '50000000-0000-4000-8000-0000000000d1', 'p2b-removed@example.invalid');
-- Removal of a member (done by the server in production): the row is deleted.
delete from public.school_teachers where user_id = '50000000-0000-4000-8000-0000000000d1';

-- t(test, role, uid, email, sql, expected): runs `sql` (must return one bigint) as the role with forged claims.
create function pg_temp.t(p_test text, p_role text, p_uid text, p_email text, p_sql text, p_expect bigint) returns void language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role, 'email', p_email)::text end, true);
  perform set_config('role', p_role, true);
  execute p_sql into n;
  reset role;
  insert into r values (p_test, case when n = p_expect then 'PASS' else 'FAIL' end, 'got ' || n || ', expected ' || p_expect);
exception when others then
  reset role;
  insert into r values (p_test,
    case when p_expect = -1 and sqlstate = '42501' then 'PASS' else 'FAIL' end,
    sqlstate || ': ' || left(sqlerrm, 100));
end $$;
grant execute on function pg_temp.t(text, text, text, text, text, bigint) to anon, authenticated;

-- ── Teacher of school A ────────────────────────────────────────────────────────────────────
select pg_temp.t('S01 teacher A reads school_accounts without a recursion error (sees only own school)', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', 'select count(*) from public.school_accounts', 1);
select pg_temp.t('S02 teacher A cannot read school B', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', $q$select count(*) from public.school_accounts where id = '40000000-0000-4000-8000-0000000000b2'$q$, 0);
select pg_temp.t('S03 teacher A sees only their own membership row (not colleagues)', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', 'select count(*) from public.school_teachers', 1);
select pg_temp.t('S04 teacher A cannot read school B members', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', $q$select count(*) from public.school_teachers where school_account_id = '40000000-0000-4000-8000-0000000000b2'$q$, 0);
select pg_temp.t('S05 teacher B cannot read school A members (cross-user, cross-school)', 'authenticated', '50000000-0000-4000-8000-0000000000b1', 'p2b-teacher-b1@example.invalid', $q$select count(*) from public.school_teachers where school_account_id = '40000000-0000-4000-8000-0000000000a1'$q$, 0);
select pg_temp.t('S05b teacher A cannot update memberships', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', $q$with u as (update public.school_teachers set role = 'admin' where school_account_id = '40000000-0000-4000-8000-0000000000a1' returning 1) select count(*) from u$q$, -1);

-- ── School administrator ───────────────────────────────────────────────────────────────────
select pg_temp.t('S06 admin A sees own school only', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', 'select count(*) from public.school_accounts', 1);
select pg_temp.t('S07 admin A reads their school''s members', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', 'select count(*) from public.school_teachers', 2);
select pg_temp.t('S08 admin A cannot read school B members', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', $q$select count(*) from public.school_teachers where school_account_id = '40000000-0000-4000-8000-0000000000b2'$q$, 0);
select pg_temp.t('S09 admin A cannot delete school B members', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', $q$with d as (delete from public.school_teachers where school_account_id = '40000000-0000-4000-8000-0000000000b2' returning 1) select count(*) from d$q$, 0);
select pg_temp.t('S10 admin A cannot update memberships (server-only since Phase 2)', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', $q$with u as (update public.school_teachers set role = 'admin' where school_account_id = '40000000-0000-4000-8000-0000000000a1' returning 1) select count(*) from u$q$, -1);
select pg_temp.t('S11 admin B cannot read school A members', 'authenticated', '50000000-0000-4000-8000-0000000000c2', 'p2b-admin-b@example.invalid', $q$select count(*) from public.school_teachers where school_account_id = '40000000-0000-4000-8000-0000000000a1'$q$, 0);

-- ── Unauthorized, removed, anonymous, wildcard-email ───────────────────────────────────────
select pg_temp.t('S12 removed member sees no school', 'authenticated', '50000000-0000-4000-8000-0000000000d1', 'p2b-removed@example.invalid', 'select count(*) from public.school_accounts', 0);
select pg_temp.t('S13 removed member sees no memberships', 'authenticated', '50000000-0000-4000-8000-0000000000d1', 'p2b-removed@example.invalid', 'select count(*) from public.school_teachers', 0);
select pg_temp.t('S14 non-member sees no school', 'authenticated', '50000000-0000-4000-8000-0000000000e1', 'p2b-outsider@example.invalid', 'select count(*) from public.school_accounts', 0);
select pg_temp.t('S15 non-member sees no memberships', 'authenticated', '50000000-0000-4000-8000-0000000000e1', 'p2b-outsider@example.invalid', 'select count(*) from public.school_teachers', 0);
select pg_temp.t('S16 anon sees no schools', 'anon', null, null, 'select count(*) from public.school_accounts', 0);
select pg_temp.t('S17 anon sees no memberships', 'anon', null, null, 'select count(*) from public.school_teachers', 0);
select pg_temp.t('S18 percent-wildcard email does not match any school admin', 'authenticated', '50000000-0000-4000-8000-0000000000e1', '%@example.invalid', 'select count(*) from public.school_teachers', 0);
select pg_temp.t('S19 underscore-wildcard email does not match an admin', 'authenticated', '50000000-0000-4000-8000-0000000000e1', 'p2b_admin_a@example.invalid', 'select count(*) from public.school_accounts', 0);
select pg_temp.t('S20 case-different admin email still matches (intended equality)', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'P2B-ADMIN-A@EXAMPLE.INVALID', 'select count(*) from public.school_accounts', 1);

-- ── The helper itself (callable directly: what does it reveal?) ────────────────────────────
select pg_temp.t('S21 helper as admin A returns exactly their own school', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', 'select count(*) from public.admin_school_account_ids()', 1);
select pg_temp.t('S22 helper as teacher A returns nothing', 'authenticated', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', 'select count(*) from public.admin_school_account_ids()', 0);
select pg_temp.t('S23 helper as non-member returns nothing', 'authenticated', '50000000-0000-4000-8000-0000000000e1', 'p2b-outsider@example.invalid', 'select count(*) from public.admin_school_account_ids()', 0);
select pg_temp.t('S24 helper is not executable by anon', 'anon', null, null, 'select count(*) from public.admin_school_account_ids()', -1);
select pg_temp.t('S25 helper with a wildcard email returns nothing', 'authenticated', '50000000-0000-4000-8000-0000000000e1', 'p2b-%@example.invalid', 'select count(*) from public.admin_school_account_ids()', 0);

-- ── Server path unaffected ─────────────────────────────────────────────────────────────────
select pg_temp.t('S26 service_role still reads all school members', 'service_role', '50000000-0000-4000-8000-0000000000a1', 'p2b-teacher-a1@example.invalid', 'select count(*) from public.school_teachers', 3);

-- ── Authorized deletion works (runs last: it changes the fixture) ──────────────────────────
select pg_temp.t('S27 admin A can remove a member of their own school', 'authenticated', '50000000-0000-4000-8000-0000000000c1', 'p2b-admin-a@example.invalid', $q$with d as (delete from public.school_teachers where user_id = '50000000-0000-4000-8000-0000000000a2' returning 1) select count(*) from d$q$, 1);

reset role;
select verdict, test, detail from r order by verdict = 'PASS', test;
