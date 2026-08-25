-- Local mirror of Razorpay refunds, same convention as razorpay_orders/
-- subscriptions (service-role only). Status is reconciled both from the
-- synchronous refund API response AND the refund.processed/refund.failed
-- webhook events (Razorpay's own recommended source of truth for final
-- status, not just the synchronous response).
create table if not exists public.razorpay_refunds (
  id uuid primary key default gen_random_uuid(),
  razorpay_refund_id text not null unique,
  razorpay_payment_id text not null,
  user_id uuid not null references auth.users(id),
  amount_paise integer not null,
  is_partial boolean not null default false,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  initiated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists razorpay_refunds_user_idx on public.razorpay_refunds (user_id);
alter table public.razorpay_refunds enable row level security;
