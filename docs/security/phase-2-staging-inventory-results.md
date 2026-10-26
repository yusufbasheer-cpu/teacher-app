# Phase 2 — live staging inventory results

**Target:** Supabase project `esqnyktumxscyvznftlc` (`layah-staging`, ap-northeast-2, Postgres 17.6, ACTIVE_HEALTHY). **Production `jbwevzvtloahjoamwnjt` was not queried.**
**Date:** 2026-10-26. **Method:** official Supabase CLI 2.122.0 (`npx`, no project dependency added) → `supabase db query --linked --project-ref esqnyktumxscyvznftlc` (Management API; no database password, `psql` or Docker). Every statement was SELECT-only and passed an automated guard (no write keywords, no side-effect functions) *before* any ran. Nothing was written to the database by the investigation, other than the CLI's own short-lived login role (see §J).
**Sanitised:** no tokens, passwords, connection strings, IP addresses or row data from application tables appear here. Database output is treated as untrusted data.

## 0. Verdict at a glance

| ID | Finding | Live status on staging | Exploitable? | Fixed by pending migration? |
|---|---|---|---|---|
| **F1** | `refund_user_generation(uuid, date)` | `SECURITY DEFINER`, **no authorization check in the body**, EXECUTE granted to **`anon` and `authenticated`** | **YES** — any caller with the public anon key can refund (decrement) any user's used-generation counter and read back that user's usage row; a user can refund themselves repeatedly to defeat plan limits | **Yes** (§1 of the migration) |
| **F2** | Credit/usage RPCs (`ensure_user_usage`, `ensure_own_user_usage`, `consume_user_generation`, `increment_user_generations`) | definer functions with **`anon` EXECUTE**; each raises `not authenticated` when `auth.uid()` is null | **No** (least-privilege defect only; authenticated callers act on themselves only) | **Yes** (§2) |
| **F3** | Gamma artifact storage authorization | bucket **private**, `storage.objects` RLS on with **0 policies** (default-deny for clients), 11/11 objects under `<user-uuid>/…`; `gamma_generations` has RLS and no client policy | **No at the database layer.** App-layer owner-folder check (Phase 2 code) is deployed in `29e013a` | Not needed in SQL |
| **F4** | `school_admin_update_teacher_role` on `school_teachers` | **Present**: `UPDATE`, role `public`, `admin_email ~~* (auth.jwt()->>'email')` (caller's email used as an ILIKE pattern → `_`/`%` wildcards), plus a full table `UPDATE` grant | **Yes in principle** (needs a mailbox whose address, with wildcards, matches a school admin's email; narrow). **No present impact on staging**: `school_accounts` = 0 rows, `school_teachers` = 0 rows | **Yes** (§3) |
| **F5** | **`school_id` vs `school_account_id`** | Live `school_teachers` has **`school_account_id` only**; `select school_id …` → `42703 column does not exist` | Not a vulnerability — a **functional break**: 7 application files query `school_id` (enrollment upsert, HOD dashboard, school-admin teacher list/updates, 3 super-admin routes). On staging these fail (several swallow the error) | No (code/schema decision, §H) |
| **F6** | Default privileges + table grants | every new `public` function is granted EXECUTE to `anon`/`authenticated`; 22 of 23 granted tables give both roles `TRUNCATE, TRIGGER, REFERENCES` + full DML (`ai_usage_events` and `gamma_generations` have no client grants at all, and `user_usage` is `SELECT`-only) | Not remotely (RLS governs DML; PostgREST cannot TRUNCATE) — **defense-in-depth** | No (proposed Phase 2b, §I) |
| **F7** | Public inserts | `feedback` and `waitlist`: `INSERT … WITH CHECK (true)` for role `public` | Spam/abuse only | No |

**Phase 2 verdict: NO-GO for "secure" until the migration is approved, dry-run, applied and the isolation tests pass.** F1 is a live, trivially reachable credit-manipulation hole on the environment that has uncapped Gamma spend.

## A. Application tables and RLS (live)

| Schema | Table | RLS | Policies |
|---|---|---|---|
| public | active_sessions | on | 4 |
| public | admin_permissions | on | 0 |
| public | admin_roles | on | 0 |
| public | ai_usage_events | on | 0 |
| public | announcements | on | 0 |
| public | audit_logs | on | 0 |
| public | differentiated_pack_generations | on | 0 |
| public | feedback | on | 1 |
| public | gamma_generations | on | 0 |
| public | generation_events | on | 0 |
| public | impersonation_sessions | on | 0 |
| public | lesson_plans | on | 4 |
| public | pending_trial_grants | on | 0 |
| public | question_paper_generations | on | 0 |
| public | razorpay_orders | on | 0 |
| public | razorpay_refunds | on | 0 |
| public | saved_lessons | on | 4 |
| public | school_accounts | on | 2 |
| public | school_registration_requests | on | 1 |
| public | school_teachers | on | 4 |
| public | school_templates | on | 1 |
| public | subscription_billing_notices | on | 0 |
| public | subscriptions | on | 0 |
| public | user_usage | on | 1 |
| public | waitlist | on | 1 |

25 public tables, **all with RLS enabled**; 15 of them have zero policies, which means default-deny for `anon`/`authenticated` (service role only). Storage system tables also have RLS on. No views or materialized views exist in `public`.

## B. Policies (live, 23)

| Table | Policy | Cmd | Roles | USING / WITH CHECK (abridged) |
|---|---|---|---|---|
| active_sessions | Users can delete own active session | DELETE | {public} | `USING (auth.uid() = user_id)` |
| active_sessions | Users can insert own active session | INSERT | {public} | `/ CHECK (auth.uid() = user_id)` |
| active_sessions | Users can update own active session | UPDATE | {public} | `USING (auth.uid() = user_id) / CHECK (auth.uid() = user_id)` |
| active_sessions | Users can view own active session | SELECT | {public} | `USING (auth.uid() = user_id)` |
| feedback | feedback_insert | INSERT | {public} | `/ CHECK true` |
| lesson_plans | Users can delete their own lesson plans | DELETE | {public} | `USING (auth.uid() = user_id)` |
| lesson_plans | Users can insert their own lesson plans | INSERT | {public} | `/ CHECK (auth.uid() = user_id)` |
| lesson_plans | Users can update their own lesson plans | UPDATE | {public} | `USING (auth.uid() = user_id) / CHECK (auth.uid() = user_id)` |
| lesson_plans | Users can view their own lesson plans | SELECT | {public} | `USING (auth.uid() = user_id)` |
| saved_lessons | Users can delete their own saved lessons | DELETE | {public} | `USING (auth.uid() = user_id)` |
| saved_lessons | Users can insert their own saved lessons | INSERT | {public} | `/ CHECK (auth.uid() = user_id)` |
| saved_lessons | Users can update their own saved lessons | UPDATE | {public} | `USING (auth.uid() = user_id) / CHECK (auth.uid() = user_id)` |
| saved_lessons | Users can view their own saved lessons | SELECT | {public} | `USING (auth.uid() = user_id)` |
| school_accounts | School admins read own school account | SELECT | {authenticated} | `USING (lower(admin_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))` |
| school_accounts | Teachers read own school account | SELECT | {authenticated} | `USING (id IN ( SELECT school_teachers.school_account_id    FROM school_teachers   WHERE (school_teachers.user_id = auth.uid())` |
| school_registration_requests | Users read own registration | SELECT | {authenticated} | `USING (admin_user_id = auth.uid())` |
| school_teachers | School admins delete school teachers | DELETE | {authenticated} | `USING (school_account_id IN ( SELECT school_accounts.id    FROM school_accounts   WHERE (lower(school_accounts.admin_email) =` |
| school_teachers | School admins read school teachers | SELECT | {authenticated} | `USING (school_account_id IN ( SELECT school_accounts.id    FROM school_accounts   WHERE (lower(school_accounts.admin_email) =` |
| school_teachers | Teachers read own school membership | SELECT | {authenticated} | `USING (user_id = auth.uid())` |
| school_teachers | school_admin_update_teacher_role | UPDATE | {public} | `USING (school_account_id IN ( SELECT school_accounts.id    FROM school_accounts   WHERE (school_accounts.admin_email ~~* (auth / CHECK (school_account_id IN ( SELECT school_accounts.id    FROM school_accounts   WHERE (school_` |
| school_templates | Users manage own template | ALL | {authenticated} | `USING (( SELECT auth.uid() AS uid) = user_id) / CHECK (( SELECT auth.uid() AS uid) = user_id)` |
| user_usage | select_own_usage | SELECT | {authenticated} | `USING (user_id = auth.uid())` |
| waitlist | waitlist_insert | INSERT | {public} | `/ CHECK true` |

## C. Functions in `public` (live)

| Function | SECURITY DEFINER | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---|---|---|---|
| `sync_school_active_teachers()` | yes | **YES** | yes | yes |
| `increment_user_generations()` | yes | **YES** | yes | yes |
| `ensure_user_usage()` | yes | **YES** | yes | yes |
| `consume_user_generation()` | yes | **YES** | yes | yes |
| `refund_user_generation(uuid,date)` | yes | **YES** | yes | yes |
| `ensure_own_user_usage()` | yes | **YES** | yes | yes |
| `usage_today_utc()` | no | **YES** | yes | yes |
| `usage_next_month_start_utc()` | no | **YES** | yes | yes |
| `plan_generations_limit(text)` | no | **YES** | yes | yes |
| `usage_row_json(user_usage,text)` | no | **YES** | yes | yes |

Default privileges for new objects created by `postgres`/`supabase_admin` in `public` grant functions (`X`), tables (`arwdDxtm`) and sequences to `anon`, `authenticated` and `service_role` (standard Supabase defaults). Any function created later, or re-created with DROP + CREATE, is therefore anon-executable until revoked.

## D. Table privileges held by `anon` / `authenticated`

22 of 23 granted public tables give **both** roles the full default set (`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`): `active_sessions`, `admin_permissions`, `admin_roles`, `announcements`, `audit_logs`, `differentiated_pack_generations`, `feedback`, `generation_events`, `impersonation_sessions`, `lesson_plans`, `pending_trial_grants`, `question_paper_generations`, `razorpay_orders`, `razorpay_refunds`, `saved_lessons`, `school_accounts`, `school_registration_requests`, `school_teachers`, `school_templates`, `subscription_billing_notices`, `subscriptions`, `waitlist`.

`user_usage` is already locked down: `anon` none, `authenticated` `SELECT` only. RLS is the only row-level control on the other tables; table-level `TRUNCATE`/`TRIGGER`/`REFERENCES` are not governed by RLS (PostgREST cannot issue TRUNCATE, so this is defense-in-depth, not a remote exploit).

## E. Storage (live)

- Bucket `gamma-pptx-artifacts`: **public = False**, file size limit 52428800 bytes, allowed MIME `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- `storage.objects`: RLS **on**, **0 policies** (default-deny for `anon`/`authenticated`; only the service role can read/write).
- Objects in the bucket: 11; **11 of 11** follow the `<user-uuid>/…` owner-folder pattern the application enforces.

## F. Migration history (live vs repository)

- Live history: 49 entries, `20260101000000` … `20261023093000`.
- Repository: 48 migration files. **All applied except** `20261025120000_phase2_rpc_and_school_policy_hardening.sql` (the pending Phase 2 migration; its version sorts after the latest applied one).
- Live-only entries: `20260101000000 lesson_plans_baseline_reconciliation`, `20260101001000 saved_lessons_baseline_reconciliation` (manual baseline reconciliation for dashboard-made tables; not in the repository).
- Gamma: `gamma_generations` has all 8 columns added by `20261023093000`; 13 rows exist (11 with a stored artifact).

## G. School tables (live)

- `school_accounts`: id, school_name, email_domain, plan_type, max_teachers, active_teachers, admin_email, created_at, status, deactivated_at?, deactivated_reason?
- `school_registration_requests`: id, admin_user_id?, admin_email, school_name, email_domain, country, num_teachers, phone, how_heard, plan_selected, plan_price, status, created_at, rejection_reason?
- `school_teachers`: id, school_account_id, user_id, email, joined_at, generations_used_this_month, role, department?
- Row counts: `school_accounts` = 0, `school_teachers` = 0 (**no real school data on staging**).
- Probe `select school_id from public.school_teachers limit 0` → `ERROR 42703: column "school_id" does not exist` (live evidence).

## H. F5 in detail — `school_id` versus `school_account_id`

- **Live truth:** `school_teachers(id, school_account_id, user_id, email, joined_at, generations_used_this_month, role, department?)`. No table in `public` has a `school_id` column.
- **Repository migrations** (`20260524143000_school_accounts.sql`, `20260613130000_…`) also define `school_account_id`. The migration **rollback comment** I flagged earlier used `school_id` and has been corrected.
- **Application code** uses `school_id` for `school_teachers` in 7 non-test files: `school-enrollment-server.ts` (8 sites incl. the enrollment `upsert`), `school-admin-server.ts` (6), `hod-server.ts` (3), `school-accounts.ts` (type), and the three super-admin routes `schools/[id]/route.ts`, `schools/[id]/admins/route.ts`, `schools/[id]/admins/[userId]/route.ts`. `hod-server.test.ts` encodes the same assumption.
- **Effect on a database built from the migrations (staging):** school enrollment, HOD lookup/dashboard, school-admin teacher list and role/department updates, and super-admin school-admin management cannot work. Several call sites swallow the error (`getHodTeacherRow` returns `null`; `loadTeachersForSchool` returns `[]`), so the failure is silent.
- **Why it probably exists:** `create table if not exists` in the migration is a no-op wherever the table already existed from a manual/dashboard creation. Production may therefore still carry a `school_id` column (or may have the same break). **That cannot be determined without a production catalog read, which was not performed.**
- **Decision needed (not made here):** (a) one read-only column listing for `school_teachers` on production, authorised by you, then (b) either change the code to `school_account_id` (if production matches staging) or add a compatible column/view on staging. Do not change code first: the wrong direction would break production.
- **Phase 2 impact:** the Phase 2 migration references **no** `school_*` column in its forward statements, so it is unaffected. The isolation test detects the column name dynamically (`school_id` or `school_account_id`).

## I. Proposed Phase 2b hardening (NOT in the pending migration; separate approval)

Derived from §C/§D. Not written as a migration file so that `db push` cannot apply it by accident.

```sql
-- 1. Future functions must not be anon/authenticated-executable by default.
alter default privileges for role postgres        in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role supabase_admin  in schema public revoke execute on functions from anon, authenticated;
-- 2. The trigger function is not an RPC.
revoke execute on function public.sync_school_active_teachers() from public, anon, authenticated;
-- 3. RLS governs DML only; remove the privileges RLS does not govern, on every public table.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on table public.%I from anon, authenticated', t);
  end loop;
end $$;
-- 4. anon never needs table access except the two public forms (insert only).
-- (generate one revoke per table other than waitlist/feedback after review)
```

## J. Tooling side effects and access notes

- The CLI was **already authenticated** on this machine (`supabase projects list` worked without a login prompt). I did not read any token store. That login can see **both** projects, production included, so every command carries the staging ref explicitly and a hard-coded guard refuses the production ref.
- Each `db query` makes the CLI create a short-lived database role `cli_login_postgres` through the Management API (observed `rolvaliduntil` ≈ 8 minutes after creation). It expires on its own; no manual cleanup is needed. This is the only change the investigation made to the database cluster.
- Linking was not performed (`supabase link` would write `supabase/.temp` into the repository). `--linked --project-ref <staging>` is used per command instead, which is stricter: a stale link can never retarget production.

## K. Review of `20261025120000_phase2_rpc_and_school_policy_hardening.sql` against the live schema

| Check | Result |
|---|---|
| Function signatures | All five exist exactly as written: `refund_user_generation(uuid, date)`, `ensure_user_usage()`, `ensure_own_user_usage()`, `consume_user_generation()`, `increment_user_generations()`; `school_teachers` exists. |
| Revokes/grants (F1) | `revoke all … from public, anon, authenticated` then `grant execute … to service_role` → removes the live anon/authenticated EXECUTE, keeps `service_role`. |
| Legitimate server-side refunds | The only caller is `src/lib/user-usage-server.ts` using the **service-role** client (`service_role` keeps EXECUTE and has `rolbypassrls = true`). Unaffected. |
| Usage RPCs (F2) | `revoke all … from public, anon`; `grant … to authenticated, service_role`. The only client caller is the browser's `ensure_user_usage` as an authenticated user. Unaffected. |
| School policy/grant (F4) | `drop policy if exists "school_admin_update_teacher_role"` (exact live policy name) and `revoke update … from anon, authenticated`. All `school_teachers` writes in the app use the service role → no legitimate flow depends on either. Remaining policies (admin read/delete, teacher reads own) stay. |
| Unintended escalation | None: only revokes and one policy drop. No grants are added except to `service_role`/`authenticated` on functions that already require `auth.uid()`. |
| Destructive changes | None: no DROP TABLE/TRUNCATE/DELETE, no data read or written. All statements guarded (`to_regprocedure`/`to_regclass`, `drop policy if exists`), idempotent. |
| Rollback documentation | Corrected (`school_account_id`). The documented rollback is accurate against the live schema. |
| Migration history | Version `20261025120000` sorts after the latest applied (`20261023093000`); all other 47 repo migrations are applied. |
| **Mechanics caveat** | `supabase db push` **refuses** while the live history contains `20260101000000` and `20260101001000` (baseline reconciliations absent from the repo): `DbPushMissingLocalError`. Do **not** "repair … reverted" those (that deletes history rows). Apply the file inside a transaction via `db query`, then record it with `supabase migration repair --status applied 20261025120000`. |
| Not covered by it | F6 (default/table privileges), F7, F5. Listed for follow-up above. |

**Dry run prepared, not executed:** `node scripts/security/phase2-cli.mjs dry-run --approve-dry-run` runs the migration's DDL plus 13 permission checks inside a transaction that always ends in `RAISE EXCEPTION` (rolled back), and prints the before/after privilege matrix.

## L. Real database tests prepared (not executed)

`scripts/security/phase-2-isolation-transaction-test.sql` (reviewed; all writes target fixed fixture UUIDs; ends in rollback) covers the required matrix, and is wrapped by `phase2-cli.mjs isolation-test --approve-fixture-test`, which appends a result-carrying `RAISE EXCEPTION` so rollback is guaranteed and results are returned:

| Required check | Tests |
|---|---|
| Anonymous access | generic per-table `anon` loop, T10b, T15a–c |
| Cross-user reads | generic per-table loop (user A vs user B rows), T19 (own access still works) |
| Cross-user updates / deletes / inserts | T03, T04, T05, T06 |
| Credit manipulation | T08a, T08b, T15a, T15c |
| Private Gamma artifacts | T10, T10b, T11, T11b, T12, T18 |
| School membership isolation | T13a–d, T20a–b |
| Removed-member access | T14 |
| Privileged RPC permissions | T15b, T16, T16b, T17 |

**Expected baseline BEFORE the migration** (these should currently FAIL — that is the evidence): T08b, T15a, T15b, T17 (refund/definer exposure) and T13d (direct client `UPDATE` of `school_teachers`). After the migration, all should PASS. Fixtures are `.invalid`-domain users in a transaction that never commits; staging holds no school data, so no real record can be touched.

## M. Exact approval requested (nothing below has been done)

1. **Approve the rolled-back dry run:** `node scripts/security/phase2-cli.mjs dry-run --approve-dry-run` (DDL inside a transaction that always aborts; brief locks on the empty `school_teachers` table).
2. **Approve the rolled-back baseline fixture test** (pre-migration, expected failures listed above): `node scripts/security/phase2-cli.mjs isolation-test --approve-fixture-test`.
3. **Approve applying the migration to staging only:** run `supabase/migrations/20261025120000_phase2_rpc_and_school_policy_hardening.sql` through `supabase db query --linked --project-ref esqnyktumxscyvznftlc --file …`, then `supabase migration repair --status applied 20261025120000 --linked --project-ref esqnyktumxscyvznftlc`.
4. **Then** re-run the isolation test (expect all PASS) and re-run the inventory to confirm F1/F2/F4 closed.
5. **Separately decide:** F5 (authorise a single read-only production column listing, or check it yourself in the dashboard) and Phase 2b hardening (§I).
