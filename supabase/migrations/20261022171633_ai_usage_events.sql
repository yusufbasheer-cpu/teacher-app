-- Append-only provider usage for the isolated AI observability console.
-- Service-role only: callers never read or write this table directly.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null check (provider in ('deepseek')),
  operation text not null,
  model text not null,
  prompt_tokens bigint check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens bigint check (completion_tokens is null or completion_tokens >= 0),
  cache_hit_tokens bigint check (cache_hit_tokens is null or cache_hit_tokens >= 0),
  cache_miss_tokens bigint check (cache_miss_tokens is null or cache_miss_tokens >= 0),
  total_tokens bigint check (total_tokens is null or total_tokens >= 0),
  estimated_cost_usd numeric(16, 8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  status text not null check (status in ('success','failed')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_user_created_at_idx
  on public.ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_events_operation_created_at_idx
  on public.ai_usage_events (operation, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from anon, authenticated;
