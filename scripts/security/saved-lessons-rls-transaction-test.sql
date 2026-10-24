begin;

create temporary table phase1_saved_lessons_results (
  test_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

grant select, insert on table pg_temp.phase1_saved_lessons_results to anon, authenticated, service_role;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'phase1-user-a@example.invalid', now(), now()),
  ('00000000-0000-4000-8000-00000000b002', 'authenticated', 'authenticated', 'phase1-user-b@example.invalid', now(), now());

insert into public.saved_lessons (
  id, user_id, subject, grade, topic, curriculum, lesson_content, ppt_content
)
values
  ('10000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a001', 'Phase 1', 'A', 'Owned by A', 'test', 'fixture-a', 'fixture-a'),
  ('10000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b002', 'Phase 1', 'B', 'Owned by B', 'test', 'fixture-b', 'fixture-b');

create function pg_temp.phase1_cross_owner_insert_is_denied()
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  begin
    insert into public.saved_lessons (
      id, user_id, subject, grade, topic, curriculum, lesson_content, ppt_content
    ) values (
      '10000000-0000-4000-8000-00000000b003',
      '00000000-0000-4000-8000-00000000b002',
      'Phase 1', 'B', 'Cross-owner insert', 'test', 'fixture', 'fixture'
    );
    return false;
  exception
    when insufficient_privilege then return true;
  end;
end;
$$;

grant execute on function pg_temp.phase1_cross_owner_insert_is_denied() to authenticated;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

insert into pg_temp.phase1_saved_lessons_results
select
  'anonymous cannot read saved lessons',
  count(*) = 0,
  'visible rows=' || count(*)
from public.saved_lessons
where id in (
  '10000000-0000-4000-8000-00000000a001',
  '10000000-0000-4000-8000-00000000b002'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into pg_temp.phase1_saved_lessons_results
select
  'user A can read own lesson',
  count(*) = 1,
  'visible rows=' || count(*)
from public.saved_lessons
where id = '10000000-0000-4000-8000-00000000a001';

insert into pg_temp.phase1_saved_lessons_results
select
  'user A cannot read user B lesson',
  count(*) = 0,
  'visible rows=' || count(*)
from public.saved_lessons
where id = '10000000-0000-4000-8000-00000000b002';

insert into pg_temp.phase1_saved_lessons_results
select
  'user A list contains only own lessons',
  count(*) = 1 and bool_and(user_id = '00000000-0000-4000-8000-00000000a001'),
  'visible rows=' || count(*)
from public.saved_lessons
where id in (
  '10000000-0000-4000-8000-00000000a001',
  '10000000-0000-4000-8000-00000000b002'
);

with changed as (
  update public.saved_lessons
  set topic = 'unauthorized update'
  where id = '10000000-0000-4000-8000-00000000b002'
  returning id
)
insert into pg_temp.phase1_saved_lessons_results
select 'user A cannot update user B lesson', count(*) = 0, 'updated rows=' || count(*)
from changed;

with removed as (
  delete from public.saved_lessons
  where id = '10000000-0000-4000-8000-00000000b002'
  returning id
)
insert into pg_temp.phase1_saved_lessons_results
select 'user A cannot delete user B lesson', count(*) = 0, 'deleted rows=' || count(*)
from removed;

insert into pg_temp.phase1_saved_lessons_results
select
  'user A cannot create a lesson owned by user B',
  pg_temp.phase1_cross_owner_insert_is_denied(),
  'RLS WITH CHECK rejected cross-owner insert';

with created as (
  insert into public.saved_lessons (
    id, user_id, subject, grade, topic, curriculum, lesson_content, ppt_content
  ) values (
    '10000000-0000-4000-8000-00000000a003',
    '00000000-0000-4000-8000-00000000a001',
    'Phase 1', 'A', 'Own insert', 'test', 'fixture', 'fixture'
  )
  returning id
)
insert into pg_temp.phase1_saved_lessons_results
select 'user A can create own lesson', count(*) = 1, 'inserted rows=' || count(*)
from created;

reset role;

do $$
begin
  if exists (
    select 1
    from pg_temp.phase1_saved_lessons_results
    where not passed
  ) then
    raise exception 'one or more saved_lessons RLS assertions failed';
  end if;
end;
$$;

select test_name, passed, detail
from pg_temp.phase1_saved_lessons_results
order by test_name;

rollback;
