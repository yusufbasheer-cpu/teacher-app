# Security Phase 2 — Database, RLS and storage isolation

> ## UPDATE 2026-10-26 — live staging evidence now exists
> The blocker recorded below ("no SQL access to the isolated staging project") has been removed. Using the official Supabase CLI (`db query --linked`, Management API) the read-only catalog inventory was run against **`esqnyktumxscyvznftlc` only**. Full sanitised results: [`phase-2-staging-inventory-results.md`](./phase-2-staging-inventory-results.md).
>
> | Finding | Live status |
> |---|---|
> | **F1** `refund_user_generation` | **EXPLOITABLE.** Definer function with no authorization check; EXECUTE live for `anon` and `authenticated`. Pending migration §1 fixes it. |
> | **F2** usage RPCs | anon EXECUTE live, but each rejects a null `auth.uid()` → not exploitable; least-privilege fix pending (§2). |
> | **F3** Gamma storage | Protected at the DB layer (private bucket, RLS on, 0 client policies, 11/11 owner-folder objects). App-layer check deployed in `29e013a`. |
> | **F4** school admin policy | **Present** (wildcard `ILIKE`, role `public`, full UPDATE grant); narrow precondition; staging has 0 school rows. Pending migration §3. |
> | **F5** `school_id` vs `school_account_id` | Resolved on staging: **`school_account_id` only**. 7 application files still query `school_id` → school flows broken on staging; production schema unknown (not queried). |
> | **F6/F7** | Default function privileges and table `TRUNCATE/TRIGGER/REFERENCES` grants (defense-in-depth); anonymous `INSERT` on `feedback`/`waitlist`. |
>
> Migration `20261025120000` was reviewed against the live schema: correct signatures, no destructive statements, legitimate service-role refunds preserved, rollback comment corrected. It is **still unapplied** and awaits approval. `supabase db push` is blocked by two live-only baseline history entries, so the approved path is `db query --file` + `migration repair --status applied`.
> The isolation test is prepared and wrapped (`scripts/security/phase2-cli.mjs`) behind explicit approval flags.
>
> **Verdict (unchanged): NO-GO for "secure".** F1 is live. Exact approvals requested: see §M of the results document.
>
> *The sections below are the original pre-access report and are kept as the audit trail.*

**Verdict: NO-GO (blocked). The code and migration are ready, but the staging-backed verification has not run.**
The brief does not accept unit tests as proof of isolation. This session had no SQL access to the isolated
staging project, so none of the following has happened yet:

- the live catalog has not been read
- the migration has not been applied
- the direct-database isolation tests have not been run

Phase 2 also cannot ship on its own: it is built on Phase 1, which is still unpushed, undeployed and NO-GO
until `CRON_SECRET` is set.

## 0. Baseline

- Production baseline: `origin/main` (`37e3bd7` locally). Phase 1 is **not** merged or deployed.
- Phase 2 worktree: `C:\Liyaah\teacher-app-security-phase2`, branch `security/phase-2-database-storage`,
  branched from the Phase 1 tip `0b302c6`.
- Target database: only the isolated `esqnyktumxscyvznftlc`. No production credentials were used. Local
  `.env.local` files point at another project (masked ref `jbwe…wnjt`), and they were deliberately not used.
- Staging access attempted:
  - The Vercel Preview (staging) Supabase values are stored as Sensitive, so they come back blank.
  - There is no Supabase CLI login and no `psql` on this machine.
  - Exploring local credential stores was refused by policy, correctly, so it was not pursued.
- Gamma, SEO and the other worktrees were not touched.

## 1–2. Inventory and RLS findings

See `phase-2-database-inventory.md`. Summary from the migrations and code:

- **25 application tables. RLS is enabled on every table created by a migration.** `saved_lessons` (dashboard-made)
  was verified live in Phase 1.
- User-private tables either have own-row policies with `auth.uid()` (and WITH CHECK on writes) or have no client
  policy at all (service role only).
- Credits (`user_usage`) are read-only for clients. Their direct INSERT/UPDATE grants were revoked by earlier
  migrations.
- No views exist in the migrations, so there is no RLS bypass through views on disk. The live check is in the
  inventory script, step 4.

## 3. Functions / RPCs

| # | Severity | Object | Root cause | Fix | Evidence | Remaining risk |
|---|---|---|---|---|---|---|
| F1 | **P1 (if the live grant exists)** | `refund_user_generation(uuid, date)` | SECURITY DEFINER and acts on a caller-supplied user id. The migration only ran `revoke … from public`, but Supabase's default privileges grant EXECUTE to `anon` and `authenticated` directly. Anyone holding the public anon key could then lower any user's used-credit count and read that user's plan/usage row. | Migration `20261025120000`: revoke from public, anon and authenticated; service_role only. The app calls it only from the server, in `user-usage-server.ts`. | Static: the function body and grant lines were read. **Live grant state not yet checked.** Tests T08b, T15a and T17. | None after the migration |
| F2 | P3 | `consume_/ensure_/ensure_own_/increment_` usage RPCs | `anon` EXECUTE through default grants. Each function raises when `auth.uid()` is NULL, so there is no exploit. | Same migration: authenticated and service_role only. | T15b, T15c | — |

## 4. Service-role usage

I traced 66 files. Results:

- `/api/super-admin/*` and `/api/razorpay/admin/*`: all 41 routes check `isAdminUser`, `isSuperAdmin` or
  `hasPermission` in every handler.
- User routes take the owner id from `authenticateRequest` (a verified JWT), never from the request body.
- The webhook checks its signature. The cron route uses bearer auth (Phase 1).
- School-admin helpers resolve the school from the **verified** sign-in email, then scope every query by that
  school id.
- Gamma store queries always filter by `user_id`.

**No service-role bypass was found.** One defence-in-depth fix:

| # | Severity | Object | Root cause | Fix | Evidence |
|---|---|---|---|---|---|
| F3 | P3 | `gamma-pptx-artifacts` reads | The server reads with the service role, trusting the `artifact_path` stored in the row. | `readGammaArtifact(userId, path)` refuses any path outside `<userId>/`, and any path containing `..`. Both callers were updated. | `src/lib/gamma/artifact.test.ts`: 5 tests pass |

## 5. Storage

There is one bucket, `gamma-pptx-artifacts`:

- private, 50 MB limit, PPTX files only
- no client object policies, so anon and authenticated are denied
- server-only access, scoped by user

No signed URLs are issued anywhere. Nothing else uses object storage. School templates are stored in Postgres.

## 6. School isolation

| # | Severity | Object | Root cause | Fix |
|---|---|---|---|---|
| F4 | P2 | policy `school_admin_update_teacher_role` and the `UPDATE` grant on `school_teachers` | Matched with `admin_email ILIKE <caller's JWT email>`, which turns the caller's email into a LIKE pattern (`_`/`%` are wildcards). The policy also allowed any column, including `user_id`, to be rewritten. Practical exploitation needs a confirmed mailbox matching the pattern at the admin's domain, so the risk is low, but the predicate is wrong. The app never uses this path. | Dropped the policy and revoked `UPDATE` from anon and authenticated. Role and department changes keep working through `/api/school-admin/teachers/[userId]` (service role, verified-email school lookup). |

Other school results:

- Removing a teacher deletes the membership row and resets that teacher to the free plan. The HOD and teacher
  read paths depend on membership, so removed teachers lose school access.
- School ownership comes from Auth (Phase 1).

**Drift:** the code uses `school_teachers.school_id`, while the migrations use `school_account_id`. The deployed
school policies must be read live (T13, T14 and T20 detect the column name automatically).

## 7. Migrations

- `supabase/migrations/20261025120000_phase2_rpc_and_school_policy_hardening.sql` covers F1, F2 and F4.
- Every statement is guarded (`to_regprocedure`, `to_regclass`, `if exists`) and can be re-run. It reads and
  writes no data.
- The rollback steps are in the file header.
- **Applied to isolated staging: NO (blocked).** Applied to production: no.

## 8–10. Tests

| Check | Result |
|---|---|
| TypeScript | pass |
| Full suite | 69 files passed, 2 skipped; 689 tests passed, 9 skipped |
| Gamma artifact access (new + existing route tests) | 8/8 pass |
| Lint (changed files) | 0 errors |
| Production build | pass, 104 pages (placeholder public Supabase env; this worktree has no `.env.local`) |
| Secret scan (new files) | clean |
| `git diff --check` | clean |
| **Live catalog inventory** | **NOT RUN (blocked)**: `scripts/security/phase-2-catalog-inventory.sql` |
| **Direct DB isolation tests (T01–T20, generic per-table checks)** | **NOT RUN (blocked)**: `scripts/security/phase-2-isolation-transaction-test.sql` |

What the isolation script does:

- It runs as `postgres` and switches into `anon` / `authenticated` with forged claims, exactly as PostgREST does.
- It covers every table that has a `user_id` column, for three callers: anon, User A, and a JWT with no subject.
- It also covers lesson write isolation and ownership reassignment, credits and the refund RPC, the grants on
  every SECURITY DEFINER function, admin self-promotion, storage read/overwrite/delete/plant, school A versus B
  (teacher and admin), removed members, and the paths authorised users still need.
- It ends in `ROLLBACK`, so no fixtures survive.

## 11. Remaining risks

- Live grants, policies and schema drift are unverified until the scripts run.
- Broad table grants to anon and authenticated (noted in Phase 1) remain. RLS is the control (P3).
- `feedback` and `waitlist` accept anonymous inserts that the app does not need (P3).
- RLS is not forced for the table owner. Service-role bypass is intentional and was audited above.

## 12. Impact on legitimate users

None expected:

- refund is called only by the server
- usage RPCs are called only by signed-in users
- no app code updates `school_teachers` from a user's session
- Gamma artifacts are always stored under `<userId>/`

## 13. Production compatibility

The migration is additive and guarded. It must be applied **after** the live catalog confirms the function
signatures. It is independent of app deploy order, because the app does not depend on the revoked grants.

## 14. Rollback

1. Run the commented statements in the migration header.
2. Revert the `readGammaArtifact` commit.

No data migration is involved.

## 15. Commits

Local only, on `security/phase-2-database-storage`. The SHA is in the handoff. Nothing was pushed, merged or
deployed.

## To close Phase 2 (operator steps)

1. Give this session SQL access to **staging only**. Either run `npx supabase login` and link the project to
   `esqnyktumxscyvznftlc`, or supply the staging DB connection string in a local, uncommitted env var.
2. Run the catalog script and paste its output into the inventory.
3. Re-check F1 against the live grants.
4. Apply the migration to staging.
5. Run the isolation script. Every row must be PASS. Fix or explain any SKIP.
6. Update this verdict.
