-- ============================================================================
-- Follow-up to 20260811130000_free_tier_three_generations.sql, which changed
-- plan_generations_limit('free') to return 3 and updated the column DEFAULT
-- — but a DEFAULT only applies to new rows, and ensure_user_usage()'s
-- monthly-reset path deliberately never touches generations_limit (so a
-- super-admin's custom limit survives rollover, see
-- 20260728120000_usage_gate_functions.sql section 5). Net effect: every
-- free-tier user who signed up before that migration kept generations_limit
-- = 15 forever, which is why "Free · 15 left" kept showing in the sidebar
-- even after the function itself was already returning 3.
--
-- Narrowly scoped exactly like the original 15-vs-3 backfill in
-- 20260728120000 (section 3): only rows that are free AND still sitting at
-- the OLD default (15) get touched, so a custom limit a super-admin set on a
-- free-tier row is never clobbered. Safe to re-run.
-- ============================================================================

update public.user_usage
set generations_limit = public.plan_generations_limit('free')
where plan_type = 'free' and generations_limit = 15;
