-- ============================================================================
-- Drops the Free plan's monthly generation limit from 15 to 3, as part of
-- the platform-wide Free vs Pro entitlement pass (src/lib/plans.ts: free.
-- generationsLimit is now 3, matching this function's 'free' branch below).
--
-- plan_generations_limit() is the live SQL-side source of truth consumed by
-- consume_user_generation()/ensure_user_usage() (see
-- 20260728120000_usage_gate_functions.sql) — editing src/lib/plans.ts alone
-- does NOT change production behavior; this function is what actually gates
-- real requests. Safe to re-run (create or replace), no data migration
-- needed — existing free-tier rows already above 3 generations_used this
-- month will simply read as "limit reached" on their next request, same as
-- any other limit change.
-- ============================================================================

create or replace function public.plan_generations_limit(p_plan text)
returns integer language sql immutable as $$
  select case p_plan
    when 'free' then 3
    when 'pro' then 30
    when 'pro_plus' then 60
    when 'school_starter' then -1
    when 'school_pro' then -1
    when 'school_enterprise' then -1
    else 3
  end
$$;

-- Re-asserted here (already set by 20260728120000_usage_gate_functions.sql,
-- idempotent to repeat) so this migration stands alone as the current
-- source-of-truth file for tests/sql-plan-parity.test.ts.
alter table public.user_usage
  alter column generations_limit set default public.plan_generations_limit('free');

-- ROLLBACK: re-run the previous migration's create-or-replace of this same
-- function (20260728120000_usage_gate_functions.sql, section 2) to restore
-- the 'free'/else branches to 15.
