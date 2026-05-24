-- school_teachers: track membership + monthly generations; keep active_teachers accurate.

alter table public.school_teachers
  add column if not exists generations_used_this_month integer not null default 0
  check (generations_used_this_month >= 0);

comment on column public.school_teachers.school_account_id is
  'FK to school_accounts (school id).';

-- Backfill counter from actual rows (fixes drift if trigger was missing).
update public.school_accounts sa
set active_teachers = coalesce(
  (
    select count(*)::integer
    from public.school_teachers st
    where st.school_account_id = sa.id
  ),
  0
);

-- Ensure trigger keeps active_teachers in sync on insert/delete.
create or replace function public.sync_school_active_teachers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.school_accounts
    set active_teachers = (
      select count(*)::integer
      from public.school_teachers
      where school_account_id = new.school_account_id
    )
    where id = new.school_account_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.school_accounts
    set active_teachers = (
      select count(*)::integer
      from public.school_teachers
      where school_account_id = old.school_account_id
    )
    where id = old.school_account_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists school_teachers_sync_active_count on public.school_teachers;
create trigger school_teachers_sync_active_count
  after insert or delete on public.school_teachers
  for each row execute function public.sync_school_active_teachers();
