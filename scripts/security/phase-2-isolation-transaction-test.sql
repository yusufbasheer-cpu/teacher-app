-- Security Phase 2 — direct-database isolation test. ISOLATED STAGING ONLY (esqnyktumxscyvznftlc).
-- Runs as the postgres role, switches into anon / authenticated with forged JWT claims exactly as
-- PostgREST does, and ROLLS BACK at the end: no fixture or change survives. Every test runs in its
-- own sub-block, so one failure (or a schema mismatch) is recorded and the rest still run.
-- Output: one row per test — PASS / FAIL / SKIP with a detail.

begin;

create temporary table r (test text primary key, verdict text not null, detail text not null default '') on commit drop;

-- Fixture identities (fixed UUIDs, .invalid emails).
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'p2-user-a@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'p2-user-b@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'p2-teacher-a@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000d4', 'authenticated', 'authenticated', 'p2-teacher-b@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000e5', 'authenticated', 'authenticated', 'p2-admin-a@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-0000000000f6', 'authenticated', 'authenticated', 'p2-admin-b@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'p2-removed@example.invalid', now(), now());

insert into public.saved_lessons (id, user_id, subject, grade, topic, curriculum, lesson_content, ppt_content) values
  ('20000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'P2', 'A', 'Owned by A', 'test', 'fixture-a', 'fixture-a'),
  ('20000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b2', 'P2', 'B', 'Owned by B', 'test', 'fixture-b', 'fixture-b');

insert into public.user_usage (user_id, plan_type, generations_used, generations_limit, reset_date) values
  ('00000000-0000-4000-8000-0000000000a1', 'free', 1, 3, (date_trunc('month', now()) + interval '1 month')::date),
  ('00000000-0000-4000-8000-0000000000b2', 'free', 2, 3, (date_trunc('month', now()) + interval '1 month')::date)
on conflict (user_id) do nothing;

-- Act as a role. claims = null → anon with no JWT; '{}' → authenticated with an empty/malformed identity.
create function pg_temp.act(p_role text, p_uid text, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null and p_role = 'anon' then ''
         when p_uid is null then '{}'
         else json_build_object('sub', p_uid, 'role', p_role, 'email', p_email)::text end, true);
  perform set_config('role', p_role, true);
end $$;
grant execute on function pg_temp.act(text, text, text) to anon, authenticated;

create function pg_temp.rec(t text, ok boolean, d text default '') returns void language sql as $$
  insert into r values (t, case when ok then 'PASS' else 'FAIL' end, coalesce(d, ''));
$$;

-- ── Generic: every public table with user_id ─────────────────────────────────────────────────────
-- (a) anon sees no rows anywhere; (b) user A sees no row owned by someone else or with NULL owner;
-- (c) a JWT with no subject sees nothing. Uses real staging data as well as fixtures.
do $$
declare t record; n bigint; v text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id' order by 1
  loop
    foreach v in array array['anon', 'A', 'nosub'] loop
      begin
        if v = 'anon' then perform pg_temp.act('anon', null, null);
        elsif v = 'nosub' then perform pg_temp.act('authenticated', null, null);
        else perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid'); end if;
        execute format('select count(*) from public.%I where %s', t.table_name,
          case when v = 'A' then 'user_id is distinct from ''00000000-0000-4000-8000-0000000000a1''::uuid' else 'true' end) into n;
        reset role;
        perform pg_temp.rec(format('generic:%s:%s', v, t.table_name), n = 0, n || ' foreign rows visible');
      exception
        when insufficient_privilege then reset role; perform pg_temp.rec(format('generic:%s:%s', v, t.table_name), true, 'permission denied');
        when others then reset role; insert into r values (format('generic:%s:%s', v, t.table_name), 'SKIP', sqlerrm);
      end;
    end loop;
  end loop;
end $$;

-- ── Lessons: write isolation (T1–T6) ────────────────────────────────────────────────────────────
do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  update public.saved_lessons set topic = 'hijacked' where id = '20000000-0000-4000-8000-0000000000b2';
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T03 A cannot modify B lesson', n = 0, n || ' rows updated');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T03 A cannot modify B lesson', true, 'permission denied'); end $$;

do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  delete from public.saved_lessons where id = '20000000-0000-4000-8000-0000000000b2';
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T04 A cannot delete B lesson', n = 0, n || ' rows deleted');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T04 A cannot delete B lesson', true, 'permission denied'); end $$;

do $$ begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  insert into public.saved_lessons (id, user_id, subject, grade, topic, curriculum, lesson_content, ppt_content)
  values ('20000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b2', 'P2', 'B', 'forged', 'test', 'x', 'x');
  reset role; perform pg_temp.rec('T05 A cannot insert a lesson owned by B', false, 'insert succeeded');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T05 A cannot insert a lesson owned by B', true, 'denied'); end $$;

do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  update public.saved_lessons set user_id = '00000000-0000-4000-8000-0000000000b2' where id = '20000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T06 A cannot reassign lesson ownership', n = 0, n || ' rows reassigned');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T06 A cannot reassign lesson ownership', true, 'denied by WITH CHECK'); end $$;

-- ── Credits / usage (T07–T09 are also covered by the generic block) ─────────────────────────────
do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  update public.user_usage set generations_limit = 9999, generations_used = 0 where user_id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2');
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T08a A cannot write any usage row (own or B)', n = 0, n || ' rows updated');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T08a A cannot write any usage row (own or B)', true, 'permission denied'); end $$;

do $$ begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  perform public.refund_user_generation('00000000-0000-4000-8000-0000000000b2', (date_trunc('month', now()) + interval '1 month')::date);
  reset role; perform pg_temp.rec('T08b A cannot call refund_user_generation for B', false, 'call succeeded');
exception
  when insufficient_privilege then reset role; perform pg_temp.rec('T08b A cannot call refund_user_generation for B', true, 'permission denied');
  when undefined_function then reset role; insert into r values ('T08b A cannot call refund_user_generation for B', 'SKIP', 'function absent'); end $$;

do $$ begin
  perform pg_temp.act('anon', null, null);
  perform public.refund_user_generation('00000000-0000-4000-8000-0000000000b2', (date_trunc('month', now()) + interval '1 month')::date);
  reset role; perform pg_temp.rec('T15a anon cannot call refund_user_generation', false, 'call succeeded');
exception
  when insufficient_privilege then reset role; perform pg_temp.rec('T15a anon cannot call refund_user_generation', true, 'permission denied');
  when undefined_function then reset role; insert into r values ('T15a anon cannot call refund_user_generation', 'SKIP', 'function absent'); end $$;

-- ── Functions (T15–T17): catalog assertions ─────────────────────────────────────────────────────
insert into r
select 'T15b anon cannot execute SECURITY DEFINER ' || p.oid::regprocedure,
       case when has_function_privilege('anon', p.oid, 'execute') then 'FAIL' else 'PASS' end, ''
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype;

insert into r
select 'T17 authenticated cannot execute definer fn taking a uuid: ' || p.oid::regprocedure,
       case when has_function_privilege('authenticated', p.oid, 'execute') then 'FAIL' else 'PASS' end, 'acts on a caller-chosen id'
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and 'uuid'::regtype = any (p.proargtypes::regtype[]);

insert into r
select 'T16 normal users cannot write admin tables: ' || t, case when exists (
  select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = t
  and g.grantee in ('anon', 'authenticated') and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and not exists (select 1 from pg_class c where c.oid = ('public.' || t)::regclass and c.relrowsecurity)
  then 'FAIL' else 'PASS' end, 'write grant without RLS'
from unnest(array['admin_roles', 'admin_permissions', 'audit_logs', 'impersonation_sessions']) t
where to_regclass('public.' || t) is not null;

do $$ begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  insert into public.admin_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'super_admin');
  reset role; perform pg_temp.rec('T16b A cannot make themselves admin', false, 'insert succeeded');
exception
  when insufficient_privilege then reset role; perform pg_temp.rec('T16b A cannot make themselves admin', true, 'denied');
  when others then reset role; insert into r values ('T16b A cannot make themselves admin', 'SKIP', sqlerrm); end $$;

-- ── Storage (T10–T12, T18) ──────────────────────────────────────────────────────────────────────
insert into storage.objects (bucket_id, name, owner)
select 'gamma-pptx-artifacts', '00000000-0000-4000-8000-0000000000b2/p2-fixture.pptx', '00000000-0000-4000-8000-0000000000b2'
where exists (select 1 from storage.buckets where id = 'gamma-pptx-artifacts');

do $$ declare n bigint; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  select count(*) into n from storage.objects where bucket_id = 'gamma-pptx-artifacts';
  reset role; perform pg_temp.rec('T10 A cannot list or read any Gamma PPTX object (no signed URL possible)', n = 0, n || ' objects visible');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T10 A cannot list or read any Gamma PPTX object (no signed URL possible)', true, 'denied'); end $$;

do $$ declare n bigint; begin
  perform pg_temp.act('anon', null, null);
  select count(*) into n from storage.objects;
  reset role; perform pg_temp.rec('T10b anon sees no storage objects', n = 0, n || ' visible');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T10b anon sees no storage objects', true, 'denied'); end $$;

do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  update storage.objects set name = name || '.x' where name = '00000000-0000-4000-8000-0000000000b2/p2-fixture.pptx';
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T11 A cannot overwrite B object', n = 0, n || ' rows updated');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T11 A cannot overwrite B object', true, 'denied'); end $$;

do $$ declare n int; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000000b2/p2-fixture.pptx';
  get diagnostics n = row_count; reset role;
  perform pg_temp.rec('T12 A cannot delete B object', n = 0, n || ' rows deleted');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T12 A cannot delete B object', true, 'denied'); end $$;

do $$ begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  insert into storage.objects (bucket_id, name, owner) values ('gamma-pptx-artifacts', '00000000-0000-4000-8000-0000000000b2/planted.pptx', '00000000-0000-4000-8000-0000000000a1');
  reset role; perform pg_temp.rec('T11b A cannot upload into B path', false, 'insert succeeded');
exception when insufficient_privilege then reset role; perform pg_temp.rec('T11b A cannot upload into B path', true, 'denied'); end $$;

insert into r select 'T18 Gamma bucket is private', case when not public then 'PASS' else 'FAIL' end, '' from storage.buckets where id = 'gamma-pptx-artifacts';

-- ── Schools (T13, T14, T20) — column names are detected; skipped with the reason if fixtures cannot be made ──
do $$
declare
  col text := (select column_name from information_schema.columns where table_schema = 'public' and table_name = 'school_teachers' and column_name in ('school_id', 'school_account_id') order by column_name = 'school_id' desc limit 1);
  sa uuid := '30000000-0000-4000-8000-0000000000a1'; sb uuid := '30000000-0000-4000-8000-0000000000b2';
  n bigint;
begin
  insert into public.school_accounts (id, school_name, admin_email, email_domain) values
    (sa, 'P2 School A', 'p2-admin-a@example.invalid', 'p2a.example.invalid'),
    (sb, 'P2 School B', 'p2-admin-b@example.invalid', 'p2b.example.invalid');
  execute format('insert into public.school_teachers (%I, user_id) values ($1, $3), ($1, $5), ($2, $4)', col)
    using sa, sb, '00000000-0000-4000-8000-0000000000c3'::uuid, '00000000-0000-4000-8000-0000000000d4'::uuid, '00000000-0000-4000-8000-000000000017'::uuid;

  -- T13: teacher A sees no other school, no other school's members.
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000c3', 'p2-teacher-a@example.invalid');
  select count(*) into n from public.school_accounts where id <> sa; reset role;
  perform pg_temp.rec('T13a school A teacher sees no other school', n = 0, n || ' visible');
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000c3', 'p2-teacher-a@example.invalid');
  execute format('select count(*) from public.school_teachers where %I <> $1', col) into n using sa; reset role;
  perform pg_temp.rec('T13b school A teacher sees no other school''s members', n = 0, n || ' visible');

  -- Admin A: sees own school's members (collaboration), nothing of school B.
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000e5', 'p2-admin-a@example.invalid');
  execute format('select count(*) from public.school_teachers where %I = $1', col) into n using sb; reset role;
  perform pg_temp.rec('T13c school A admin sees nothing of school B', n = 0, n || ' visible');
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000e5', 'p2-admin-a@example.invalid');
  execute format('select count(*) from public.school_teachers where %I = $1', col) into n using sa; reset role;
  perform pg_temp.rec('T20a school A admin still sees own school''s teachers', n >= 1, n || ' visible');
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000c3', 'p2-teacher-a@example.invalid');
  select count(*) into n from public.school_accounts where id = sa; reset role;
  perform pg_temp.rec('T20b school A teacher still reads own school', n = 1, n || ' visible');

  -- Admin A cannot rewrite memberships directly (now server-only).
  begin
    perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000e5', 'p2-admin-a@example.invalid');
    execute format('update public.school_teachers set role = ''admin'' where %I = $1', col) using sa;
    get diagnostics n = row_count; reset role;
    perform pg_temp.rec('T13d direct client update of school_teachers is blocked', n = 0, n || ' rows updated');
  exception when insufficient_privilege then reset role; perform pg_temp.rec('T13d direct client update of school_teachers is blocked', true, 'permission denied'); end;

  -- T14: removed member loses access.
  execute format('delete from public.school_teachers where user_id = $1') using '00000000-0000-4000-8000-000000000017'::uuid;
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-000000000017', 'p2-removed@example.invalid');
  select count(*) into n from public.school_accounts; reset role;
  perform pg_temp.rec('T14 removed member sees no school', n = 0, n || ' visible');
exception when others then
  reset role; insert into r values ('T13/T14/T20 school fixtures', 'SKIP', sqlerrm) on conflict do nothing;
end $$;

-- ── Authorized access still works (T19) ─────────────────────────────────────────────────────────
do $$ declare n bigint; begin
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  select count(*) into n from public.saved_lessons where id = '20000000-0000-4000-8000-0000000000a1'; reset role;
  perform pg_temp.rec('T19a A reads own lesson', n = 1, n || ' visible');
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  select count(*) into n from public.user_usage where user_id = '00000000-0000-4000-8000-0000000000a1'; reset role;
  perform pg_temp.rec('T19b A reads own usage', n = 1, n || ' visible');
  perform pg_temp.act('authenticated', '00000000-0000-4000-8000-0000000000a1', 'p2-user-a@example.invalid');
  perform public.consume_user_generation(); reset role;
  perform pg_temp.rec('T19c A can still reserve a generation via RPC', true, '');
exception when others then reset role; insert into r values ('T19 authorized access', 'FAIL', sqlerrm) on conflict do nothing; end $$;

do $$ begin
  perform pg_temp.act('anon', null, null);
  perform public.consume_user_generation(); reset role;
  perform pg_temp.rec('T15c anon cannot reserve a generation', false, 'call succeeded');
exception when insufficient_privilege or invalid_authorization_specification then reset role; perform pg_temp.rec('T15c anon cannot reserve a generation', true, sqlerrm); end $$;

reset role;
select verdict, test, detail from r order by verdict = 'PASS', test;
select verdict, count(*) from r group by 1 order by 1;

rollback;
