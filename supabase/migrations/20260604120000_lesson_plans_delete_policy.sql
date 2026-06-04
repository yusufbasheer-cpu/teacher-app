-- Allow users to delete their own lesson plans (required for My Lessons delete button).
drop policy if exists "Users can delete their own lesson plans" on public.lesson_plans;
create policy "Users can delete their own lesson plans"
  on public.lesson_plans
  for delete
  using (auth.uid() = user_id);
