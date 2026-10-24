# Layah security hardening - Phase 1 closure report

Report date: 2026-10-24 (IST)

## Closure verdict

The endpoint-authorization changes and isolated `saved_lessons` ownership controls passed source, automated, build, and database-backed verification.

The current recommendation is **NO-GO** because Vercel project `project-scquo` has no `CRON_SECRET` configured for Production. The application fails closed, so the endpoint is protected, but scheduled subscription maintenance cannot run. After an approved operator configures a strong Sensitive Production secret and redeploys the intended commit, Phase 1 is **GO**, subject to the post-deployment cron smoke checks below.

No production database or environment variable was changed. Nothing was pushed, merged, or deployed. Phase 2 was not started.

## Baseline and verified environment

- Baseline: `43161a855e6d9f92313ed8dccc73237c45f5d739` from `origin/experiment/gamma-ppt-integration`.
- Branch/worktree: `security/phase-1-api-authorization` at `C:\Liyaah\teacher-app-security-phase1`.
- Vercel: `project-scquo`; requested Gamma branch Preview was Ready.
- Supabase: `esqnyktumxscyvznftlc`, project name `layah-staging`, status `ACTIVE_HEALTHY`.
- Preview isolation reported `isolated=true`, `ok=true`, environment `staging`, and an allowlist matching that ref.
- The separate project `jbwevzvtloahjoamwnjt` was not queried or modified.
- [Endpoint inventory](./phase-1-endpoint-inventory.md)
- [CRON_SECRET instructions](./cron-secret-configuration.md)

## 1. Cron security verdict

The repository has one scheduled endpoint: `GET /api/cron/subscription-maintenance`, scheduled by `vercel.json` at `0 0 * * *`. Authorization runs before service-role client creation or reconciliation.

| Case | Verified result |
|---|---|
| Server secret missing | HTTP 401; privileged code not called |
| Authorization missing | HTTP 401 |
| Wrong bearer | HTTP 401 |
| Spoofed `x-vercel-cron-schedule` | HTTP 401 |
| Ordinary Supabase user bearer/cookie | HTTP 401 |
| Correct bearer | Accepted; reconciliation called |
| Secret logging | None found |
| Comparison | Constant-time for equal-length values; missing secret fails closed |

No user-controlled header, frontend state, cookie, or ordinary user session establishes internal-service authority.

## 2. CRON_SECRET configuration status

Read-only Vercel listings were inspected without revealing values:

- Production: not configured.
- Preview branch `experiment/gamma-ppt-integration`: not configured.
- No Vercel variable was created, updated, or removed.

[cron-secret-configuration.md](./cron-secret-configuration.md) gives exact dashboard and interactive CLI steps. Generate the value outside source using an approved password manager or cryptographically secure generator and store it as Sensitive.

## 3. Actual saved_lessons schema and policies

Read-only metadata inspection ran first against the verified isolated project.

- Table: `public.saved_lessons`; owner: `postgres`.
- Primary key: `id uuid default gen_random_uuid()`.
- Owner: `user_id uuid not null`.
- Foreign key: `user_id -> auth.users(id) on delete cascade`.
- Additional foreign key: `flagged_by -> auth.users(id)`.
- RLS enabled: yes; forced for owner: no.
- Database functions/RPCs referencing the table: none found.

| Policy | Command | Roles | USING | WITH CHECK |
|---|---|---|---|---|
| Users can view their own saved lessons | SELECT | PUBLIC | `auth.uid() = user_id` | - |
| Users can insert their own saved lessons | INSERT | PUBLIC | - | `auth.uid() = user_id` |
| Users can update their own saved lessons | UPDATE | PUBLIC | `auth.uid() = user_id` | `auth.uid() = user_id` |
| Users can delete their own saved lessons | DELETE | PUBLIC | `auth.uid() = user_id` | - |

`anon`, `authenticated`, and `service_role` have table grants including SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, and TRUNCATE. RLS controls row operations exposed through the Data API; service role bypasses RLS. The broad grants are a defense-in-depth observation, not a reproduced Phase 1 endpoint bypass.

## 4. User A/User B isolation

A single database transaction created synthetic User A/User B rows and lessons, switched to the real `anon` and `authenticated` roles with fixture JWT claims, asserted access, and rolled back.

All 8 assertions passed:

1. Anonymous cannot read lessons.
2. User A can read User A's lesson.
3. User A cannot read User B's lesson.
4. User A cannot update User B's lesson.
5. User A cannot delete User B's lesson.
6. User A cannot insert a lesson owned by User B.
7. User A can insert a lesson owned by User A.
8. User A lists reveal only User A's lesson.

Cleanup verification found 0 fixture users and 0 fixture lessons. No real lesson or customer user was read, updated, or deleted by the test.

## 5. Service-role ownership paths

- HOD access first derives a trusted HOD membership, then derives teacher IDs from the same school and department, and filters `saved_lessons` by those IDs. New tests lock both scopes.
- Super-admin listing requires a verified user and trusted DB admin role.
- Super-admin moderation requires the admin role plus `content.moderate`.
- No ordinary user API route uses service role to access `saved_lessons`.
- No `saved_lessons` RPC was found.

## 6. Vulnerabilities and fixes

Fixed:

1. Spoofable cron schedule header replaced by fail-closed `CRON_SECRET` bearer verification.
2. Cron authentication failures standardized to 401 before privileged work.
3. School enrollment no longer trusts client email/domain identity.
4. School registration derives owner ID, email, and domain from verified Auth.
5. Gamma artifact downloads remain scoped to the authenticated user.
6. HOD service-role lesson access has explicit school/department scope and tests.

No `saved_lessons` RLS vulnerability was reproduced. No RLS migration was required or applied.

## 7. Files changed

Application/tests:

- `src/lib/api-authorization.ts` and test.
- Cron, school-enrollment, school-registration, and Gamma artifact route tests/handlers.
- `src/lib/school-enrollment-client.ts`, `src/lib/auth-post-login.ts`, and school registration UI.
- `src/lib/hod-server.test.ts`.

Evidence/docs:

- `scripts/security/saved-lessons-metadata.sql`.
- `scripts/security/saved-lessons-rls-transaction-test.sql`.
- `docs/security/phase-1-endpoint-inventory.md`.
- `docs/security/cron-secret-configuration.md`.
- This report.

## 8. Verification

- TypeScript: passed.
- Full suite: 68 files passed, 2 skipped; 684 tests passed, 9 skipped.
- Authentication/security regressions: passed.
- Production build: passed; 104 static pages generated.
- Lint: 0 errors, 78 existing warnings.
- Isolated metadata inspection: passed.
- Isolated RLS transaction: 8/8 passed.
- Rollback cleanup: 0 fixture users/lessons remained.
- Secret scan: passed.
- Git diff check: passed.

## 9. Remaining risks

Operational blocker:

- Production `CRON_SECRET` is absent. Current recommendation remains **NO-GO**.

After approved configuration and redeployment, verify missing/wrong/user tokens return 401, run one authorized invocation without printing headers, and confirm the exact deployed commit and alias. If those pass, Phase 1 is **GO**.

Non-blocking defense-in-depth observations for a later approved phase:

- Policies target PUBLIC rather than explicitly authenticated, although `auth.uid()` predicates deny anonymous access.
- Table grants are broader than the Data API requires.
- RLS is not forced for the owner; service-role bypass remains intentional.

## 10. Git status

Phase 1 is committed locally on `security/phase-1-api-authorization` in logical commits. The implementation commit is `fba4dc0` (`fix(security): enforce API authorization boundaries`); the closure evidence and this report are in the following local documentation commit. Nothing was pushed, merged, or deployed. Exact SHAs are in the final handoff.

STOP: Phase 2 was not started.
