-- ============================================================================
-- Migration 2 of 2 in the paywall/usage-limit hardening pass — THE LOCKDOWN.
--
-- This is the migration that actually closes the paywall bypass: today,
-- `authenticated` has direct INSERT/UPDATE grants on public.user_usage, and
-- the RLS policies on it (supabase/migrations/20260525200000_user_usage_rls_named_policies.sql)
-- restrict only WHICH ROW a user can touch (auth.uid() = user_id), not WHICH
-- COLUMN. Since NEXT_PUBLIC_SUPABASE_ANON_KEY is public and every logged-in
-- user holds their own JWT, this means any authenticated user can currently
-- run, from a browser console or curl:
--
--   PATCH /rest/v1/user_usage?user_id=eq.<their own id>
--   { "plan_type": "pro_plus", "generations_limit": 99999, "generations_used": 0 }
--
-- ...and it succeeds. This migration revokes that.
--
-- >>> APPLY THIS ONLY AFTER:
-- >>>   1. Migration 1 (20260728120000_usage_gate_functions.sql) is applied
-- >>>      and verified (see its own verification block).
-- >>>   2. The Phase 4 app change (reserveGeneration/refundGeneration via the
-- >>>      new RPCs) is deployed and confirmed generating successfully.
-- >>>   3. The Phase 5 app change (this same commit) is deployed — it
-- >>>      deletes the two browser-side direct writes to user_usage
-- >>>      (dashboard/page.tsx's client upsert, and
-- >>>      user-usage-client.ts's ensureUserUsageOnClient, which now calls
-- >>>      the ensure_user_usage() RPC instead of a raw insert). Those two
-- >>>      writes would otherwise start failing with "permission denied"
-- >>>      the moment this migration runs.
--
-- >>> IF SOMETHING BREAKS AFTER APPLYING THIS: run the ROLLBACK block at the
-- >>> bottom of this file FIRST (a few seconds), THEN redeploy the previous
-- >>> app version if needed. Do not `vercel rollback` before rolling back
-- >>> this migration — the old app code calls the same RPCs the new code
-- >>> does, plus the two now-deleted direct writes, which would still fail
-- >>> against the locked-down table even on old app code.
-- ============================================================================

alter table public.user_usage enable row level security;

-- Read-only for the end user — the UI needs to display "x of 15 used".
drop policy if exists "Users can view own usage" on public.user_usage;
drop policy if exists select_own_usage           on public.user_usage;
create policy select_own_usage on public.user_usage
  for select to authenticated
  using (user_id = auth.uid());

-- Remove every direct write path for the end user. Writes now only happen
-- through ensure_user_usage() / consume_user_generation() / refund_user_generation()
-- (all security definer, Phase 3) or through the service-role client
-- (super-admin change-plan, school enrollment, etc. — already service role).
drop policy if exists "Users can insert own usage" on public.user_usage;
drop policy if exists "Users can update own usage" on public.user_usage;
drop policy if exists insert_own_usage            on public.user_usage;
drop policy if exists update_own_usage            on public.user_usage;

-- Policies alone are not the enforcement boundary here — PostgREST checks
-- the table-level GRANT first. This REVOKE is the line that actually closes
-- the bypass; the policy changes above are what's left over once it's safe
-- to still allow reads.
revoke all on table public.user_usage from public;
revoke all on table public.user_usage from anon;
revoke all on table public.user_usage from authenticated;

grant select on table public.user_usage to authenticated;
grant all    on table public.user_usage to service_role;

-- ============================================================================
-- VERIFICATION — run in the Supabase SQL Editor after applying.
-- ============================================================================
--
-- 1. THE BYPASS PROOF — run this as an actual logged-in user, both BEFORE
--    applying this migration (to see it currently succeeds) and AFTER (to
--    confirm it now fails). Get USER_ACCESS_TOKEN from a real browser
--    session: DevTools -> Application -> Local Storage ->
--    sb-<project-ref>-auth-token -> access_token.
--
--    curl -i -X PATCH \
--      "https://<PROJECT_REF>.supabase.co/rest/v1/user_usage?user_id=eq.<USER_ID>" \
--      -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
--      -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
--      -H "Content-Type: application/json" \
--      -d '{"plan_type":"pro_plus","generations_limit":99999,"generations_used":0}'
--
--    BEFORE this migration: HTTP 204 No Content   <- the bug, fixed by this file
--    AFTER  this migration: HTTP 401/403 "permission denied for table user_usage"
--
-- 2. Confirm reads still work (the UI needs this) — same request but GET,
--    no body — should still return 200 with the user's own row.
--
-- 3. Confirm INSERT is also refused (a user should not be able to create
--    their own row directly either — only via ensure_user_usage()):
--    same PATCH command as #1 but as POST with a body containing a
--    user_id the caller doesn't already have a row for — expect 401/403.
--
-- 4. Canary at T+5min and T+30min after deploy — generation should still be
--    happening (via the RPCs) and new signups should still get rows created
--    (via ensure_user_usage()):
--
--    select count(*) filter (where generations_used > 0) as users_with_usage,
--           sum(generations_used)                        as total_generations,
--           max(created_at)                               as newest_row
--    from public.user_usage;
--
--    total_generations should keep rising and newest_row should advance as
--    people sign up. If either flatlines, run the ROLLBACK block below.
-- ============================================================================

-- ============================================================================
-- ROLLBACK — paste into the SQL editor and run if this migration needs to be
-- undone quickly. Restores the pre-lockdown grants and policies exactly.
-- ============================================================================
-- grant select, insert, update on table public.user_usage to authenticated;
-- create policy insert_own_usage on public.user_usage
--   for insert to authenticated with check (user_id = auth.uid());
-- create policy update_own_usage on public.user_usage
--   for update to authenticated using (user_id = auth.uid())
--   with check (user_id = auth.uid());
-- ============================================================================
