-- Ensure active_sessions exists with expected columns (safe if created manually in Supabase).
create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,
  device_info text not null default '',
  created_at timestamptz not null default now()
);

alter table public.active_sessions enable row level security;

drop policy if exists "Users can view own active session" on public.active_sessions;
create policy "Users can view own active session"
  on public.active_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own active session" on public.active_sessions;
create policy "Users can insert own active session"
  on public.active_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own active session" on public.active_sessions;
create policy "Users can update own active session"
  on public.active_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own active session" on public.active_sessions;
create policy "Users can delete own active session"
  on public.active_sessions for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.active_sessions to authenticated;
