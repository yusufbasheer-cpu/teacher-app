-- Add curriculum and chapter context to saved lesson plans (safe to re-run).

alter table public.lesson_plans add column if not exists curriculum_type text not null default 'Other';
alter table public.lesson_plans add column if not exists chapter text not null default '';

drop policy if exists "Users can update their own lesson plans" on public.lesson_plans;
create policy "Users can update their own lesson plans"
  on public.lesson_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
