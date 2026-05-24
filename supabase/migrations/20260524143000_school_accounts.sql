-- School accounts and teacher membership (email domain → school plan).
create extension if not exists "pgcrypto";

create table if not exists public.school_accounts (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  email_domain text not null,
  plan_type text not null default 'school_starter'
    check (plan_type in ('school_starter', 'school_pro', 'school_enterprise')),
  max_teachers integer not null check (max_teachers > 0),
  active_teachers integer not null default 0 check (active_teachers >= 0),
  admin_email text not null,
  created_at timestamptz not null default now(),
  constraint school_accounts_email_domain_unique unique (email_domain)
);

create index if not exists school_accounts_email_domain_idx
  on public.school_accounts (lower(email_domain));

create table if not exists public.school_teachers (
  id uuid primary key default gen_random_uuid(),
  school_account_id uuid not null references public.school_accounts(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  joined_at timestamptz not null default now()
);

create index if not exists school_teachers_school_account_id_idx
  on public.school_teachers (school_account_id);

-- Keep active_teachers in sync with school_teachers rows.
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
      select count(*)::integer from public.school_teachers where school_account_id = new.school_account_id
    )
    where id = new.school_account_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.school_accounts
    set active_teachers = (
      select count(*)::integer from public.school_teachers where school_account_id = old.school_account_id
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

alter table public.school_accounts enable row level security;
alter table public.school_teachers enable row level security;

-- Teachers can read their own school row.
drop policy if exists "Teachers read own school account" on public.school_accounts;
create policy "Teachers read own school account"
  on public.school_accounts for select
  to authenticated
  using (
    id in (
      select school_account_id from public.school_teachers where user_id = auth.uid()
    )
  );

-- Teachers read their own membership.
drop policy if exists "Teachers read own school membership" on public.school_teachers;
create policy "Teachers read own school membership"
  on public.school_teachers for select
  to authenticated
  using (user_id = auth.uid());

grant select on table public.school_accounts to authenticated;
grant select on table public.school_teachers to authenticated;
