-- Ledger for the experimental Gamma PPT renderer. Service-role only (RLS on, no policies).
-- Purpose: never lose a paid generation id, resume instead of re-submitting, enforce per-user limits and credit budgets.
create table if not exists public.gamma_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_hash text not null,
  -- submitting: create call sent, outcome not yet known. pending: Gamma accepted (generation_id set).
  -- unknown: create call may have been accepted but we never got an id. completed/failed: terminal per Gamma.
  -- abandoned: active row that aged out; still counted as reserved credits.
  status text not null check (status in ('submitting','pending','unknown','completed','failed','abandoned')),
  generation_id text,
  requested_slides integer not null,
  credits_deducted numeric,
  credits_remaining numeric,
  error_code text,
  delivered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most ONE active paid generation per user: duplicate/concurrent submissions fail atomically at the database.
create unique index if not exists gamma_generations_one_active_per_user
  on public.gamma_generations (user_id)
  where status in ('submitting','pending','unknown');

create index if not exists gamma_generations_user_created on public.gamma_generations (user_id, created_at desc);
create index if not exists gamma_generations_created on public.gamma_generations (created_at desc);

alter table public.gamma_generations enable row level security;

-- Defence in depth: Supabase grants anon/authenticated ALL on new public tables by default. RLS (no policies) already denies
-- them every row; revoking the grants means a future permissive policy cannot accidentally expose the ledger.
revoke all on public.gamma_generations from anon, authenticated;
