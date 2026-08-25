-- Question papers and differentiated packs aren't persisted anywhere
-- server-side today (only lesson plans are, client-side, via saved_lessons/
-- lesson_plans) — so neither is moderatable. Both new tables are written
-- server-side from their generation routes, regardless of whether the
-- user chooses to save/download.
create table if not exists public.question_paper_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  grade text,
  topic text,
  curriculum text,
  content jsonb not null,
  flagged boolean not null default false,
  flagged_reason text,
  flagged_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists question_paper_generations_user_created_idx
  on public.question_paper_generations (user_id, created_at);
alter table public.question_paper_generations enable row level security;

create table if not exists public.differentiated_pack_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  grade text,
  topic text,
  curriculum text,
  content jsonb not null,
  flagged boolean not null default false,
  flagged_reason text,
  flagged_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists differentiated_pack_generations_user_created_idx
  on public.differentiated_pack_generations (user_id, created_at);
alter table public.differentiated_pack_generations enable row level security;

-- Lesson plans already persist (saved_lessons) — just need moderation columns.
alter table public.saved_lessons add column if not exists flagged boolean not null default false;
alter table public.saved_lessons add column if not exists flagged_reason text;
alter table public.saved_lessons add column if not exists flagged_by uuid references auth.users(id);
alter table public.saved_lessons add column if not exists deleted_at timestamptz;
