-- Pro users get a rolling 30-day generation-quota reset (anchored to when they went Pro),
-- instead of the calendar-month reset every other plan uses. Free/pro_plus/school unaffected.
--
-- Also fixes a correctness gap that only matters now that real auto-pay subscriptions exist
-- (see subscriptions table, 20260807120000): this RPC used to unconditionally auto-extend ANY
-- paid plan's reset date forward forever, which was fine when every paid plan was a one-time
-- purchase. It is NOT fine for a cancelled/halted subscription -- without this fix, a user whose
-- Pro Monthly auto-pay was cancelled or failed would keep getting free perpetual 30-day renewals
-- just by using the app. Once a user has ever had a row in `subscriptions` (any status), this RPC
-- stops touching their plan/reset_date entirely -- the webhook (POST /api/razorpay/webhook)
-- becomes the sole authority for that user's Pro state from then on. Users who paid once with no
-- subscription at all (annual Pro, Pro Plus) keep the existing auto-extend-forever behavior,
-- just switched from calendar-month math to rolling 30-day math for `pro`.
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
  has_subscription boolean;
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

  if row.reset_date <= now()::date then
    if row.plan_type = 'pro' then
      select exists(select 1 from public.subscriptions where user_id = uid) into has_subscription;

      if not has_subscription then
        update public.user_usage
        set generations_used = 0, reset_date = (now() + interval '30 days')::date, generations_limit = 30
        where user_id = uid
        returning * into row;
      end if;
      -- else: managed subscription (any status, even cancelled/halted) -- the webhook owns this
      -- row from now on, leave it untouched here.
    else
      lim := case row.plan_type
        when 'free' then 15
        when 'pro_plus' then 60
        else -1
      end;

      update public.user_usage
      set generations_used = 0, reset_date = next_reset, generations_limit = lim
      where user_id = uid
      returning * into row;
    end if;
  end if;

  return row;
end;
$$;
