-- Trial/pause tracking + offer linkage on subscriptions. 'paused' added to
-- the status CHECK (previously created/active/pending/halted/cancelled only).
alter table public.subscriptions add column if not exists trial_end_at timestamptz;
alter table public.subscriptions add column if not exists paused_at timestamptz;
alter table public.subscriptions add column if not exists intended_resume_at date;
alter table public.subscriptions add column if not exists pause_reason text;
alter table public.subscriptions add column if not exists active_offer_id text;
alter table public.subscriptions add column if not exists offer_scheduled_at timestamptz;

do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'subscriptions'
    and con.contype = 'c'
    and att.attname = 'status';

  if v_constraint_name is not null then
    execute format('alter table public.subscriptions drop constraint %I', v_constraint_name);
  end if;

  alter table public.subscriptions
    add constraint subscriptions_status_check
    check (status in ('created', 'active', 'pending', 'halted', 'cancelled', 'paused'));
end $$;

-- Grants a trial to a user who hasn't subscribed yet — checkout is
-- self-serve (the user clicks "upgrade"), so an admin can't create a
-- subscription on someone else's behalf; instead create-subscription reads
-- an unconsumed grant for the calling user and applies start_at from it.
-- Razorpay's own start_at trial mechanism only works at subscription
-- CREATION time — it cannot be added retroactively to an already-active
-- subscription (use pause/resume for that case instead).
create table if not exists public.pending_trial_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_days integer not null check (trial_days > 0),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  expires_at timestamptz not null
);
-- At most one *active* (unconsumed) grant per user — a partial unique index,
-- not a table constraint, since Postgres CHECK/UNIQUE constraints can't be
-- conditional inline in CREATE TABLE.
create unique index if not exists pending_trial_grants_one_active_per_user
  on public.pending_trial_grants (user_id) where (consumed_at is null);
alter table public.pending_trial_grants enable row level security;
