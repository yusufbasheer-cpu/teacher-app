-- Ensure RLS allows authenticated users to read/insert/update their own usage row.
alter table public.user_usage enable row level security;

drop policy if exists "Users can view own usage" on public.user_usage;
create policy "Users can view own usage"
  on public.user_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.user_usage;
create policy "Users can insert own usage"
  on public.user_usage
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.user_usage;
create policy "Users can update own usage"
  on public.user_usage
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on table public.user_usage to authenticated;
