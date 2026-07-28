-- ============================================================================
-- Migration 1 of 2 in the paywall/usage-limit hardening pass — ADDITIVE ONLY.
-- Safe to run at any time, safe to re-run. Nothing in the currently-deployed
-- app calls any of the functions below, so applying this migration cannot
-- break production by itself. Apply it, verify it with the checks at the
-- bottom of this file, THEN deploy the matching app change (see the Phase 4
-- commit) before applying migration 2 (20260728123000_user_usage_lockdown.sql).
--
-- Why this exists: the app currently gates generations with a check-then-act
-- pattern that isn't atomic (a user can exceed their limit with concurrent
-- requests), and the free-tier default drifted to 3 in this table's DDL while
-- every TypeScript copy says 15 (see src/lib/plans.ts). This migration fixes
-- both by moving reset + check + increment into one security-definer RPC
-- under a row lock, with a single SQL-side source of truth for plan limits
-- that a vitest spec (src/lib/plans.test.ts's sibling spec, added in Phase 3
-- of the app change) cross-checks against src/lib/plans.ts.
--
-- ROLLBACK: see the commented block at the very bottom of this file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. UTC date helpers.
--    Never write bare date_trunc('month', now()) — that truncates in the
--    SESSION time zone. This is exactly how the app's TS and SQL reset-date
--    logic drifted from each other before (see school-plan-reset-date.ts).
--    `now() at time zone 'utc'` pins the calculation to UTC regardless of
--    the connecting session's timezone setting.
-- ---------------------------------------------------------------------------
create or replace function public.usage_today_utc()
returns date language sql stable as $$
  select (now() at time zone 'utc')::date
$$;

create or replace function public.usage_next_month_start_utc()
returns date language sql stable as $$
  select (date_trunc('month', (now() at time zone 'utc')) + interval '1 month')::date
$$;

-- ---------------------------------------------------------------------------
-- 2. THE SQL SOURCE OF TRUTH for plan limits. -1 means unlimited.
--    Mirrors src/lib/plans.ts PLANS exactly. Keep the plan ids and numbers in
--    this function's CASE branches in sync with that file — a vitest spec
--    parses this file's text and fails if they ever disagree again.
-- ---------------------------------------------------------------------------
create or replace function public.plan_generations_limit(p_plan text)
returns integer language sql immutable as $$
  select case p_plan
    when 'free' then 15
    when 'pro' then 30
    when 'pro_plus' then 60
    when 'school_starter' then -1
    when 'school_pro' then -1
    when 'school_enterprise' then -1
    else 15
  end
$$;

-- ---------------------------------------------------------------------------
-- 3. Fix the 3-vs-15 drift at the source: the column default now DERIVES
--    from the function above instead of hardcoding a second copy of the
--    number, so it cannot drift from plan_generations_limit again.
-- ---------------------------------------------------------------------------
alter table public.user_usage
  alter column generations_limit set default public.plan_generations_limit('free');

-- Backfill legacy rows created under the old default of 3. Deliberately
-- narrow to plan_type = 'free' so this can never clobber a custom limit a
-- super-admin set on a paid plan.
update public.user_usage
set generations_limit = public.plan_generations_limit('free')
where plan_type = 'free' and generations_limit = 3;

-- School plans are unlimited by definition; make sure every existing row
-- agrees, in case one was ever created with a finite limit by mistake.
update public.user_usage
set generations_limit = -1
where plan_type in ('school_starter', 'school_pro', 'school_enterprise')
  and generations_limit is distinct from -1;

-- ---------------------------------------------------------------------------
-- 4. Shared row -> jsonb shaper. jsonb (not a composite type or RETURNS
--    TABLE) on purpose: nothing to drop on rollback, no plpgsql OUT-parameter
--    name collisions with the table's own column names, and supabase-js
--    receives a plain object back from .rpc(...).
-- ---------------------------------------------------------------------------
create or replace function public.usage_row_json(p_row public.user_usage, p_outcome text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'outcome',           p_outcome,
    'user_id',           p_row.user_id,
    'plan_type',         p_row.plan_type,
    'generations_used',  p_row.generations_used,
    'generations_limit', p_row.generations_limit,
    'reset_date',        p_row.reset_date,
    'created_at',        p_row.created_at
  )
$$;

-- ---------------------------------------------------------------------------
-- 5. ensure_user_usage() — create-if-missing + monthly reset, atomically.
--    Callable by the end user because it can only ever act on auth.uid() and
--    can only ever write safe, self-consistent values.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_usage;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Insert first (on conflict do nothing) so the FOR UPDATE below always
  -- finds a row, and two concurrent first-ever calls for the same brand-new
  -- user can't both try to insert and violate the user_id unique constraint.
  insert into public.user_usage (user_id, plan_type, generations_used, generations_limit, reset_date)
  values (v_uid, 'free', 0, public.plan_generations_limit('free'), public.usage_next_month_start_utc())
  on conflict (user_id) do nothing;

  select * into v_row from public.user_usage where user_id = v_uid for update;

  -- Monthly reset. Deliberately does NOT touch generations_limit, so a
  -- custom limit a super-admin set survives the rollover (the old TS
  -- applyMonthlyResetIfNeeded clobbered it back to the plan default every
  -- month).
  if public.usage_today_utc() >= v_row.reset_date then
    update public.user_usage
    set generations_used = 0,
        reset_date       = public.usage_next_month_start_utc()
    where user_id = v_uid
    returning * into v_row;
  end if;

  -- Self-heal only CLEARLY invalid limits (0, negative-but-not-the--1
  -- sentinel, or a school plan whose limit isn't -1) — never a plausible
  -- custom limit.
  if v_row.generations_limit = 0
     or v_row.generations_limit < -1
     or (v_row.plan_type in ('school_starter', 'school_pro', 'school_enterprise')
         and v_row.generations_limit <> -1)
  then
    update public.user_usage
    set generations_limit = public.plan_generations_limit(v_row.plan_type)
    where user_id = v_uid
    returning * into v_row;
  end if;

  return public.usage_row_json(v_row, 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. consume_user_generation() — reset + CHECK + increment as ONE atomic
--    unit under the FOR UPDATE row lock. This is the actual paywall: the app
--    now reserves a generation with this call BEFORE spending money on
--    DeepSeek/fal, instead of checking the limit and incrementing the
--    counter in two separate round-trips with a 30-120s AI call in between.
--    outcome: 'incremented' | 'limit_reached' | 'unlimited'
-- ---------------------------------------------------------------------------
create or replace function public.consume_user_generation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_usage;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Runs inside this same transaction, so the row lock it takes is still
  -- held for the check + increment below.
  perform public.ensure_user_usage();

  select * into v_row from public.user_usage where user_id = v_uid for update;

  if v_row.plan_type in ('school_starter', 'school_pro', 'school_enterprise')
     or v_row.generations_limit = -1 then
    return public.usage_row_json(v_row, 'unlimited');
  end if;

  if v_row.generations_used >= v_row.generations_limit then
    return public.usage_row_json(v_row, 'limit_reached');
  end if;

  update public.user_usage
  set generations_used = generations_used + 1
  where user_id = v_uid
  returning * into v_row;

  return public.usage_row_json(v_row, 'incremented');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. refund_user_generation() — give the generation back when the DeepSeek/
--    fal call after reservation fails, so a failed generation still costs
--    the user nothing (matching today's behaviour, just moved earlier).
--
--    SECURITY: granted to service_role ONLY, never to authenticated. If a
--    logged-in user could call this themselves, they could call it in a loop
--    and zero out their own counter — it takes p_user_id explicitly because
--    auth.uid() is null when called with the service-role key.
-- ---------------------------------------------------------------------------
create or replace function public.refund_user_generation(p_user_id uuid, p_reset_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_usage;
begin
  select * into v_row from public.user_usage where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('outcome', 'no_row');
  end if;

  -- Never refund across a month rollover (that would hand a free generation
  -- into the new month) and never go below zero.
  if v_row.reset_date is distinct from p_reset_date or v_row.generations_used <= 0 then
    return public.usage_row_json(v_row, 'refund_skipped');
  end if;

  update public.user_usage
  set generations_used = generations_used - 1
  where user_id = p_user_id
  returning * into v_row;

  return public.usage_row_json(v_row, 'refunded');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants.
-- ---------------------------------------------------------------------------
revoke all on function public.ensure_user_usage()                from public;
revoke all on function public.consume_user_generation()          from public;
revoke all on function public.refund_user_generation(uuid, date) from public;

grant execute on function public.ensure_user_usage()          to authenticated;
grant execute on function public.consume_user_generation()    to authenticated;
grant execute on function public.plan_generations_limit(text) to authenticated, service_role;

-- refund: service_role ONLY. See the security note in section 7.
grant execute on function public.refund_user_generation(uuid, date) to service_role;

grant all on table public.user_usage to service_role;

-- ============================================================================
-- VERIFICATION — run these in the same SQL editor after applying the
-- migration above.
-- ============================================================================
-- -- 1. Functions exist, are security definer, owned by a role that bypasses
-- --    RLS (should be the same role that owns increment_user_generations()):
-- select proname, pg_get_userbyid(proowner) as owner, prosecdef
-- from pg_proc where proname in
--   ('ensure_user_usage','consume_user_generation','refund_user_generation','plan_generations_limit');
--
-- -- 2. Limits agree with src/lib/plans.ts:
-- select p, public.plan_generations_limit(p) from unnest(array
--   ['free','pro','pro_plus','school_starter','school_pro','school_enterprise']) p;
-- -- expect: 15, 30, 60, -1, -1, -1
--
-- -- 3. Backfill worked, no legacy 3s remain on free:
-- select plan_type, generations_limit, count(*)
-- from public.user_usage group by 1,2 order by 1,2;
--
-- -- 4. UTC boundary sanity:
-- select public.usage_today_utc(), public.usage_next_month_start_utc();
--
-- -- 5. Exercise the gate as a real user WITHOUT persisting anything —
-- --    replace <A_REAL_USER_UUID> with an actual row's user_id:
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<A_REAL_USER_UUID>","role":"authenticated"}';
--   select public.consume_user_generation();   -- expect outcome=incremented, used+1
--   select public.consume_user_generation();   -- expect used+2
-- rollback;
--
-- -- 6. Re-run this entire migration file a second time — it should succeed
-- --    identically (idempotency check).
-- ============================================================================

-- ============================================================================
-- ROLLBACK — paste into the SQL editor and run if this migration needs to be
-- undone. The column default must be dropped BEFORE plan_generations_limit,
-- since the default expression depends on that function existing.
-- ============================================================================
-- alter table public.user_usage alter column generations_limit set default 15;
-- drop function if exists public.refund_user_generation(uuid, date);
-- drop function if exists public.consume_user_generation();
-- drop function if exists public.ensure_user_usage();
-- drop function if exists public.usage_row_json(public.user_usage, text);
-- drop function if exists public.plan_generations_limit(text);
-- drop function if exists public.usage_next_month_start_utc();
-- drop function if exists public.usage_today_utc();
-- -- increment_user_generations() was never touched by this migration; the
-- -- currently-deployed app still works exactly as before if you stop here.
