-- Append-only log of individual generation attempts (lesson plan, question
-- paper, differentiated pack), success and failure. Nothing today can
-- reconstruct "generations over time" analytics — user_usage.generations_used
-- is a single rolling aggregate counter, not a log. Written server-side from
-- all 3 generation routes.
create table if not exists public.generation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_type text not null check (generation_type in ('lesson_plan', 'question_paper', 'differentiated_pack')),
  status text not null check (status in ('success', 'failed')),
  plan_type text not null,
  -- differentiated_pack generations aren't metered against quota today
  -- (no reserveGeneration() call in that route) — logged here for visibility,
  -- not silently changed to start metering them.
  metered boolean not null default true,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists generation_events_created_at_idx on public.generation_events (created_at);
create index if not exists generation_events_user_created_idx on public.generation_events (user_id, created_at);
create index if not exists generation_events_type_created_idx on public.generation_events (generation_type, created_at);

-- Service-role only, no client policies — same convention as subscriptions/razorpay_orders.
alter table public.generation_events enable row level security;
