-- Optional national / jurisdictional framework (empty string = none).
alter table public.lesson_plans
  add column if not exists curriculum_framework text not null default '';
