-- Broadcast messages to all users or a filtered segment. Email-only for
-- Part 1 (reuses the existing sendEmail()) — an in-app notification center
-- is a materially bigger, separate scope addition, not built here.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  segment text not null default 'all',
  segment_filter jsonb,
  channel text not null default 'email' check (channel in ('email', 'in_app', 'both')),
  sent_by uuid not null references auth.users(id),
  sent_at timestamptz,
  recipient_count integer,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
