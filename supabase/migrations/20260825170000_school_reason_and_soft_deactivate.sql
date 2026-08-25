-- Rejection now requires a reason, captured for the audit trail and the
-- rejection email.
alter table public.school_registration_requests
  add column if not exists rejection_reason text;

-- "Deactivate school" was a hard DELETE despite school_accounts.status
-- already existing (default 'active', added in
-- 20260528130000_school_registration_requests.sql, never constrained).
-- Switching to a soft status flag so deactivating a school doesn't cascade-
-- delete every one of its school_teachers rows.
alter table public.school_accounts
  add column if not exists deactivated_at timestamptz;
alter table public.school_accounts
  add column if not exists deactivated_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'school_accounts_status_check'
  ) then
    alter table public.school_accounts
      add constraint school_accounts_status_check check (status in ('active', 'inactive'));
  end if;
end $$;
