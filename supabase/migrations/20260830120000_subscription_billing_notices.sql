-- Track which renewal reminders were sent for which billing cycle.
-- This keeps the 25th / 27th / 29th / 30th-day emails idempotent without
-- overloading the subscriptions table with temporary bookkeeping columns.
create table if not exists public.subscription_billing_notices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  cycle_end date not null,
  reminder_day integer not null check (reminder_day in (5, 3, 1, 0)),
  sent_at timestamptz not null default now(),
  unique (subscription_id, cycle_end, reminder_day)
);

alter table public.subscription_billing_notices enable row level security;

