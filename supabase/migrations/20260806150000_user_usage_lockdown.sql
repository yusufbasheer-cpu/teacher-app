-- Close the plan-escalation bypass: any authenticated user currently has a raw table-level
-- UPDATE/INSERT grant on user_usage (from 20260525180000 / 20260525200000), scoped by RLS only to
-- "your own row" -- meaning a user can set their OWN plan_type/generations_limit/generations_used
-- to anything valid (e.g. school_enterprise, unlimited) directly via a Supabase client call,
-- bypassing Razorpay entirely. This is the real payment integrity fix; Razorpay itself was already
-- signature-verified server-side.
--
-- The legitimate client-side uses of insert/update on this table (create-on-first-login, monthly
-- reset) are moved into this SECURITY DEFINER RPC, scoped to auth.uid(), which the app now calls
-- instead of raw insert/update. The atomic increment RPC (increment_user_generations) already
-- works this way and is untouched.
create or replace function public.ensure_own_user_usage()
returns public.user_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.user_usage;
  next_reset date := (date_trunc('month', now()) + interval '1 month')::date;
  lim integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into row from public.user_usage where user_id = uid for update;

  if not found then
    insert into public.user_usage (user_id, plan_type, generations_used, generations_limit, reset_date)
    values (uid, 'free', 0, 15, next_reset)
    returning * into row;
    return row;
  end if;

  -- Monthly reset, mirrors src/lib/user-usage.ts's getGenerationsLimitForPlan (free=15, pro=30,
  -- pro_plus=60, school plans=-1/unlimited) -- kept in sync manually, same as increment_user_generations().
  if row.reset_date <= now()::date then
    lim := case row.plan_type
      when 'free' then 15
      when 'pro' then 30
      when 'pro_plus' then 60
      else -1
    end;

    update public.user_usage
    set generations_used = 0, reset_date = next_reset, generations_limit = lim
    where user_id = uid
    returning * into row;
  end if;

  return row;
end;
$$;

revoke all on function public.ensure_own_user_usage() from public;
grant execute on function public.ensure_own_user_usage() to authenticated;

-- The actual lockdown: remove the client's direct write path now that ensure_own_user_usage()
-- and increment_user_generations() cover every legitimate client-side need.
drop policy if exists insert_own_usage on public.user_usage;
drop policy if exists update_own_usage on public.user_usage;
revoke insert, update on table public.user_usage from authenticated;

-- Make the school-admin "edit teacher role/department" grant explicit rather than relying on
-- ambient/default project ACLs (the migration that added the matching RLS policy,
-- 20260613130000, never added a corresponding GRANT).
grant update on table public.school_teachers to authenticated;
