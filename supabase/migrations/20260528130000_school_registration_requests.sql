-- Pending school registration requests from /school-register.
create table if not exists public.school_registration_requests (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text not null,
  school_name text not null,
  email_domain text not null,
  country text not null,
  num_teachers text not null,
  phone text not null default '',
  how_heard text not null default '',
  plan_selected text not null,
  plan_price text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.school_registration_requests enable row level security;

create policy "Users read own registration"
  on public.school_registration_requests for select
  to authenticated
  using (admin_user_id = auth.uid());

grant select on table public.school_registration_requests to authenticated;
