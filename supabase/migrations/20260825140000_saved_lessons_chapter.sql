-- Chapter name is now shown as the primary title everywhere the "My Lessons"
-- list/dashboard/HOD dashboard display a lesson (topic shown as a secondary
-- distinction alongside it, when also given). saved_lessons never had this
-- column — lesson_plans does, but saved_lessons is what every list/dashboard
-- view actually reads from. Safe to re-run.
alter table public.saved_lessons add column if not exists chapter text not null default '';
