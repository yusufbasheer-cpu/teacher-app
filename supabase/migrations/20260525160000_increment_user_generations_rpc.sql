-- Atomic generation counter increment (runs as authenticated user via auth.uid()).
create or replace function public.increment_user_generations()
returns public.user_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.user_usage;
  next_reset date := (date_trunc('month', now()) + interval '1 month')::date;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into row from public.user_usage where user_id = uid for update;

  if not found then
    insert into public.user_usage (user_id, plan_type, generations_used, generations_limit, reset_date)
    values (uid, 'free', 0, 3, next_reset)
    returning * into row;
  end if;

  if row.plan_type in ('school_starter', 'school_pro', 'school_enterprise') then
    return row;
  end if;

  update public.user_usage
  set generations_used = generations_used + 1
  where user_id = uid
  returning * into row;

  return row;
end;
$$;

revoke all on function public.increment_user_generations() from public;
grant execute on function public.increment_user_generations() to authenticated;
