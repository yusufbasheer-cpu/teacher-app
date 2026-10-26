# Phase 2 — live staging inventory results

**Target:** Supabase project `esqnyktumxscyvznftlc` (`layah-staging`, ap-northeast-2, Postgres 17.6, ACTIVE_HEALTHY). **Production `jbwevzvtloahjoamwnjt` was not queried.**
**Date:** 2026-10-26. **Method:** official Supabase CLI 2.122.0 (`npx`, no project dependency added) → `supabase db query --linked --project-ref esqnyktumxscyvznftlc` (Management API; no database password, `psql` or Docker). Every statement was SELECT-only and passed an automated guard (no write keywords, no side-effect functions) *before* any ran. Nothing was written to the database by the investigation, other than the CLI's own short-lived login role (see §J).
**Sanitised:** no tokens, passwords, connection strings, IP addresses or row data from application tables appear here. Database output is treated as untrusted data.

## CLOSURE 2 (2026-10-26) — F8 fixed on staging; F5 decided — read this first

**F8 inspection.** Live catalog: tables owned by `postgres`, RLS enabled and not forced, `postgres` has `BYPASSRLS`, session user is `postgres`, no existing helper. The cycle is exactly two edges: `school_accounts."Teachers read own school account"` → `school_teachers`, and `school_teachers."School admins read/delete school teachers"` → `school_accounts`. Cutting one edge suffices.

**Helper review (SECURITY DEFINER not assumed safe).** `public.admin_school_account_ids()`: no parameters (nothing to enumerate), returns `uuid` ids only, equality on `lower(admin_email)` vs the caller's own JWT email (no LIKE, so `_`/`%` are literal), `set search_path = ''` with schema-qualified relations, owner `postgres`, EXECUTE revoked from `PUBLIC`/`anon` and granted to `authenticated`/`service_role` (policies run with the invoking role's privilege). Direct callers learn only which schools *they* administer, which "School admins read own school account" already shows them. Tests S21–S25 exercise it directly (admin: own school only; teacher, non-member, wildcard-email: nothing; anon: denied).

**Migration.** `supabase/migrations/20261026120000_phase2b_school_rls_recursion_fix.sql`, SHA-256 `065b9e7a473b7a235d6052d22ccb2c0dd237586944b05787984deb27f0189671`. Phase 2 migration `1a121d0a…2221` untouched. No destructive statement.

**Dry run** (whole migration applied inside a rolled-back transaction, then the 28 tests): **28/28 PASS**. Rollback proven: afterwards the helper did not exist, all five original policies were intact, 0 fixtures, 0 pending transactions, history still 50 rows.

**Apply + live verification.** Applied atomically to staging only. Live catalog: helper owner `postgres`, `secdef`, `stable`, `search_path=""`, ACL `{postgres, service_role, authenticated}` (no PUBLIC/anon); `School admins read/delete school teachers` now call the helper; **0** `school_teachers` policies reference `school_accounts`; the other three policies and all Phase 2 grants unchanged; no data changed. History: one `migration repair --status applied 20261026120000` → 50→51 rows, 0 existing rows changed or removed, baseline rows and the Phase 2 row byte-identical.

**Test results.** New school suite `scripts/security/phase-2b-school-rls-test.sql` (28 checks: teacher own/other school, admin A/B, unauthorised, removed member, anon, cross-user, cross-school update/delete, wildcard/underscore/case emails, helper direct calls, service role, authorized member removal):
| State | Result |
|---|---|
| Before fix (live) | **25 FAIL / 3 PASS** — every authenticated check `42P17 infinite recursion`; only anon (S16–17) and service role (S26) passed |
| Dry run with migration (rolled back) | **28 PASS** |
| After apply (live) | **28 PASS** |
| Full Phase 2 isolation suite after apply | **89 PASS / 0 FAIL / 0 SKIP** (T13a–d, T14, T20a–b now execute) |
| Real staging REST API, public anon key | `school_accounts`, `school_teachers` → `200 []`; helper RPC and `refund_user_generation` → `401 42501` |
Fixture cleanup: 0 fixture users, 0 school rows, auth users unchanged (2), 0 pending transactions.
**Limit:** a live *authenticated* JWT request was **not** made (would require a committed throwaway user, outside the rollback-only authorization). Authenticated behaviour = catalog privileges + forged-claims simulation (the mechanism PostgREST uses), reported as such.

**Production school schema (metadata only; independent identity check: the live production bundle points at `jbwevzvtloahjoamwnjt`).** `school_teachers` there has `school_id` (nullable), no `generations_used_this_month`, nullable `user_id`/`email`/`role`, `UNIQUE (school_id,user_id)`, no CHECKs, two indexes. Full sanitised comparison: [`school-teachers-schema-comparison.md`](./school-teachers-schema-comparison.md).

**F5 decision.** Repo/staging contract (`school_account_id`, `UNIQUE(user_id)`, `generations_used_this_month`) is the one under which all code paths are satisfiable; production is behind it. Staging code keeps `ff87bfd`. **It must not reach production before production is aligned** (it would break production school queries). A data-preserving production alignment is drafted in the comparison doc — not approved, not run. No duplicate column, no shim.

**Status after Closure 2:** F1, F2, F4, F8 closed on staging; F5 decided (staging code correct, production unaligned); F6/F7 hardening still proposed; live authenticated-session test pending. Phase 2 on staging: **GO**; production: **NO-GO**.

---

## CLOSURE (2026-10-26, applied to staging)

> Sections 0–M below are the **pre-migration snapshot** and are kept as the audit trail. This section records what was done afterwards, on **staging only**. Production was never queried or touched.

### Environment verification (before every operation)
- Management API: ref `esqnyktumxscyvznftlc` = **`layah-staging`** (Postgres 17.6.1.166; production is 17.6.1.121). The runner constant-refuses the production ref (a probe copy pointed at production threw before sending anything).
- Database fingerprint (staging-only facts): Gamma tables with rows, migrations through `20261023093000`, 2 auth users, 0 school rows.
- Migration file `supabase/migrations/20261025120000_phase2_rpc_and_school_policy_hardening.sql`, **SHA-256 `1a121d0aac1b1845ab7a7718aba50b9c07ae87a036ae3609efddcc452db12221`**, identical to the committed blob and to what was dry-run and applied. The history table stores no checksum column (`version`, `statements`, `name`), so the hash is recorded here.
- Before-state: `refund_user_generation` ACL `{postgres, anon, authenticated, service_role = X}`; the four usage RPCs likewise; wildcard policy present; `UPDATE` on `school_teachers` held by `anon` and `authenticated`; `refund_user_generation` body hash `7bdbd182b48581195f0d6cffd23d561d`.

### Dry run (rolled back) — covers the **whole** migration
The complete file ran inside a transaction that ended in `RAISE EXCEPTION`. It is one guarded `DO` block, and every object it guards exists live, so every branch executed. In-transaction results: `refund_user_generation` anon **false**, authenticated **false**, service_role **true**; the four usage RPCs anon **false**, authenticated **true** (consume/ensure) ; wildcard policy **gone** (3 policies remain); `UPDATE` on `school_teachers` false for anon and authenticated. **Rollback proof:** a catalog snapshot after the dry run was identical to the snapshot before it (grants, ACLs, policies, update privilege, history, function-definition hash), and nothing was recorded for the migration.

### Baseline isolation test (before migration, rolled back, fixture users only)
Result: **9 FAIL · 69 PASS · 2 SKIP** (after fixing two defects in the test's own school fixture — missing NOT NULL `max_teachers` and `email`).
| Check | Baseline | Meaning |
|---|---|---|
| T15a anon can call `refund_user_generation` | **FAIL — call succeeded** | anonymous callers could refund credits |
| T08b user A refunds user B | **FAIL — call succeeded** | cross-user credit manipulation |
| T15b anon can execute 5 definer functions | **FAIL ×5** | least-privilege exposure |
| T17 authenticated can execute a definer fn that takes a caller-chosen id | **FAIL** | same root cause |
| T13/T14/T20 school isolation | **FAIL — `infinite recursion detected in policy for relation 'school_accounts'`** | NEW finding F8 (below) |
| generic:A / generic:nosub `school_teachers` | SKIP — same recursion error | |
| T03–T06 cross-user update/delete/insert/reassign, T08a, T10–T12/T18 Gamma storage, T15c, T16/T16b, T19 | PASS | RLS isolation and private storage already held |
Real user records were not touched: all DML targeted fixed fixture UUIDs; transactions always rolled back.

### Migration applied (atomic) and verified
Applied to staging only via `supabase db query --linked --project-ref esqnyktumxscyvznftlc --file <migration>` (a single `DO` statement ⇒ atomic). **Verified against the live catalog, not just the command's exit status:**
| Object | Before | After |
|---|---|---|
| `refund_user_generation(uuid,date)` | anon ✔ authenticated ✔ service_role ✔ | anon ✘ authenticated ✘ **service_role ✔** (ACL `{postgres, service_role}`); body unchanged (same hash) |
| `ensure_user_usage()`, `ensure_own_user_usage()`, `consume_user_generation()`, `increment_user_generations()` | anon ✔ authenticated ✔ service_role ✔ | anon ✘ **authenticated ✔ service_role ✔** |
| policy `school_admin_update_teacher_role` | present (wildcard `ILIKE`, role `public`) | **dropped**; remaining: admins delete, admins read, teachers read own |
| `UPDATE` on `school_teachers` | anon ✔ authenticated ✔ | anon ✘ authenticated ✘ service_role ✔ (SELECT/DELETE kept) |
| data | 2 users, 0 school rows | unchanged |
Not changed by design: helper functions `plan_generations_limit`, `usage_*` and trigger function `sync_school_active_teachers` remain executable by `anon`/`authenticated` (see §I).

### Migration-history reconciliation (documented, minimal)
`supabase db push` was **not** used (blocked by the two live-only baseline rows). The version was confirmed absent, the change set confirmed present in the catalog, and then exactly one command ran: `supabase migration repair --status applied 20261025120000 --linked --project-ref esqnyktumxscyvznftlc`. Snapshot comparison (row hash per row): **49 → 50 rows; added only `20261025120000 phase2_rpc_and_school_policy_hardening`; 0 existing rows changed or removed; `20260101000000` and `20260101001000` byte-identical.**

### Post-migration tests
- **In-database (rolled back):** **1 FAIL · 79 PASS · 2 SKIP.** Now passing: T15a, T08b, T15b ×5, T17. New **T21a/T21b pass: the legitimate `service_role` refund still works (used 2→1) and still refuses a stale reset date.** T10–T12/T18 (private Gamma artifacts), T19 (normal user operations) and T03–T06 pass. The only FAIL/SKIPs are the school-policy recursion (F8), unchanged by this migration.
- **Through the real staging REST API with the public anon key** (an outsider's view; random non-existent UUID so no record can be affected): `refund_user_generation`, `ensure_user_usage`, `consume_user_generation`, `increment_user_generations`, `ensure_own_user_usage` → **HTTP 401 `42501 permission denied for function …`**; direct `PATCH school_teachers` → **401 `42501`**.
- **Not proven by a real session:** the *authenticated* role was verified by catalog privileges and in-database role simulation (T08b, T17), not by a live logged-in JWT (no staging test session exists).

### Fixture cleanup evidence (after all runs)
Fixture users `p2-%@example.invalid` **0**, fixture lessons **0**, fixture usage rows **0**, fixture storage objects **0**, `school_accounts` **0**, `school_teachers` **0**, auth users **2 (unchanged)**, pending prepared transactions **0**. (Gamma object/row counts rose by one between inspections because testers are actively using staging; unrelated to these tests.)

### F8 — NEW: mutually recursive school RLS policies (not fixed; separate approval)
`school_accounts` policy "Teachers read own school account" subqueries `school_teachers`, whose policy "School admins read school teachers" subqueries `school_accounts` → every `authenticated` read of either table raises `42P17 infinite recursion`. It **fails closed** (an error, no data exposure) and the application is unaffected because it reads these tables with the service role, but it makes client-side school isolation untestable and any future client read of these tables broken. Minimal fix to propose (not applied): two `STABLE SECURITY DEFINER` helpers (`my_school_account_ids()` from `school_teachers`, `my_admin_school_ids()` from `school_accounts`; `set search_path = public`; `revoke … from public, anon`; `grant … to authenticated`) and rewrite the cross-referencing subqueries in the three policies to call them. Requires separate approval and its own dry run + isolation test.

### F5 — school column mismatch (status)
Live column is `school_account_id` (FK `school_teachers_school_account_id_fkey → school_accounts(id) ON DELETE CASCADE`); no `school_id` anywhere. A **separate, minimal application-code commit** (local only, not deployed) renames the DB-column references in 7 files + 1 test fixture to `school_account_id`; the auth `user_metadata.school_id` key is deliberately untouched. Typecheck clean, 741 tests pass. **Production's column name was not checked (not authorised); this code change must not reach production until it is.** The mismatch is therefore **fixed in code for staging, unverified for production — not resolved overall.**

### Closure verdict
- **F1 no longer exploitable on staging** (verified live: catalog + in-DB role tests + external REST). F2 and F4 closed. F3 was already protected.
- Restricted grants verified live; service-role refunds verified operational; migration tracking consistent and auditable; no production touched.
- **Remaining open:** F8 (fail-closed, separate approval), F5 production verification, F6/F7 (hardening), and real-session authenticated verification.
- **Phase 2 database verdict for staging: GO (F1/F2/F4 closed). Phase 2 overall: not "complete"** until F8 is resolved and an authenticated session test is run. **Production: NO-GO.**

---

## 0. Verdict at a glance (PRE-MIGRATION SNAPSHOT)

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
