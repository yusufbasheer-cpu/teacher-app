-- RLS policies for user_usage (run in Supabase SQL editor if migrations are not applied).
alter table public.user_usage enable row level security;

drop policy if exists "Users can view own usage" on public.user_usage;
drop policy if exists "Users can insert own usage" on public.user_usage;
drop policy if exists "Users can update own usage" on public.user_usage;
drop policy if exists select_own_usage on public.user_usage;
drop policy if exists insert_own_usage on public.user_usage;
drop policy if exists update_own_usage on public.user_usage;

create policy select_own_usage on public.user_usage
  for select using (user_id = auth.uid());

create policy insert_own_usage on public.user_usage
  for insert with check (user_id = auth.uid());

create policy update_own_usage on public.user_usage
  for update using (user_id = auth.uid());

grant select, insert, update on table public.user_usage to authenticated;
