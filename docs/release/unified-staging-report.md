# Unified staging — consolidation report

Prepared on branch `release/unified-staging` (worktree `C:\Liyaah\teacher-app-unified-staging`), cut from `origin/staging` @ `052d638`.
**Nothing pushed, merged or deployed. Production untouched. No branch, worktree or commit was deleted or rewritten.**
Integrated code tip: **`a18abb0`** (this report is committed on top of it).

# >>> DEPLOYMENT RESULT (2026-10-26) — read this first <<<

**Staging is deployed and live. It is NOT declared fully secure or fully verified** (see "Not verified" below).

| # | Item | Result |
|---|---|---|
| 1 | Vercel project / team | `project-scquo` (`prj_evS8AChRJBl5N7nY7ZO5ItrBLhg1`), team `teacher-app` ("Mohammed Yusuf's projects"). The existing CLI session (Vercel CLI 58.9.0, authenticated as `yusufbasheer-cpu`) was used for read-only inspection; no token, OTP or password was requested or read. The deploy itself was the Git push. |
| 2 | Domain configuration | `staging.layah.in` is a project domain with **`gitBranch: staging`**, verified, no redirect, **no custom environment** (a Preview domain). `www.layah.in` has no branch (Production). **No domain or branch setting was changed.** |
| 3 | Branch binding | Follows `staging` (the earlier worry that it followed the Gamma experiment branch was wrong). Production branch is `main`; Production still serves `dc955af`. |
| 4 | Git | `git push origin release/unified-staging:staging`, fast-forward `052d638..29e013a`, no force. `main` unchanged. Local `staging` (`74a9784`) and all other branches/worktrees untouched. |
| 5 | Final SHA / deployment | **`29e013a`** · **`dpl_9BkvWxdNgapZWjXCRDjKvewzAjL6`** · `https://project-scquo-nggkd2ke1-teacher-app.vercel.app` · Preview · READY (built automatically by the Vercel–GitHub integration, region iad1). `staging.layah.in` aliases this deployment (checked with `vercel inspect staging.layah.in`). Previous deployment, for rollback: `dpl_8V2X3ksNWZHahboQKwNmybPFAz4C` (`052d638`, `project-scquo-m84u5g9ix-teacher-app.vercel.app`). |
| 6 | Supabase identity | Live `/api/environment-check`: `isolated: true, ok: true, supabaseRef: esqnyktumxscyvznftlc, violations: [], anonKeyMatchesProject: true, serviceKeyMatchesProject: true, liveRazorpayKeyPresent: false, siteUrl: https://staging.layah.in`. The production ref `jbwevzvtloahjoamwnjt` is absent from the client bundle; in source it exists only as a blocklist constant in server-side isolation guards and operator scripts. |
| 7 | HTTPS | Valid (HSTS `max-age=31536000; includeSubDomains`). `robots.txt` = `Disallow: /`. |

## Environment-variable metadata (names and scopes only; no values read)
54 variables. **Branch-scoped to `staging`** (they override the shared Preview+Production entries): `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, all `GAMMA_*` (including `GAMMA_API_KEY`, `GAMMA_ENVIRONMENT_NAME`, `GAMMA_ALLOWED_SUPABASE_REFS`, `GAMMA_EXPORT_HOST_ALLOWLIST`), `PPT_GENERATION_PROVIDER`, `EXPERIMENT_*`, `RAZORPAY_KEY_ID/KEY_SECRET/PRO_PLAN_ID/WEBHOOK_SECRET`, `DEEPSEEK_*_USD_PER_MILLION`.
**Configured:** Gamma, DeepSeek key, fal.ai key (Preview), Supabase (staging override), isolation guard.

**Findings — shared with Production, not branch-scoped. Not changed; your decision:**
1. `DEEPSEEK_API_KEY`: the same key serves Preview and Production, so usage and cost cannot be separated.
2. `NEXT_PUBLIC_POSTHOG_KEY/HOST`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` point at production projects; staging is protected only by the new code gate (verified live: 0 outbound telemetry requests). Safer long term: remove them from the Preview scope.
3. `SMTP_*`: staging sends auth and welcome mail through the production SMTP account. `SUPER_ADMIN_PIN` is shared.
4. `PYTHON_PPT_API_URL` is shared with Production (the `PPT_TEMPLATE_SERVICE_*` pair has a separate Preview entry).
5. `PEXELS_API_KEY` exists for Production only, so the stock-photo fallback is unavailable on staging.
6. `CRON_SECRET` is absent everywhere, so the cron endpoint fails closed (verified live: 401 for no auth, a forged `x-vercel-cron-schedule` header, and a wrong bearer). That is fine for Preview, where crons do not run, but it is **required before Production can run maintenance**.
7. Razorpay keys are staging-scoped; test-versus-live was confirmed only through the server-side isolation check (`liveRazorpayKeyPresent: false`), not by reading values.
Not inspectable from here: Supabase Auth redirect URLs and Site URL (dashboard), storage bucket privacy.

## Pre-deployment checks (on the pushed tip)
`tsc` clean · Vitest 77 files, **741 passed**, 11 skipped · ESLint 0 errors (72 warnings, baseline) · `next build` passes · secret scan of the diff clean · client bundle has no production ref, no server-secret names, no key-shaped strings · `build` is plain `next build` (no migration step) · app does not need the unapplied Phase 2 migration to start · cron fails closed.

## Live smoke tests on https://staging.layah.in (anonymous only)
**Passed:** `/`, `/pricing`, `/about`, `/faq`, `/login`, `/signup` return 200 with title, canonical and JSON-LD; mobile 390 px has no horizontal scroll; anonymous `/my-lesson-plans` redirects to `/login`; **0** outbound PostHog/Sentry/`/ingest`/GA requests; no secret patterns in `/`, `/login`, `/pricing`, `/api/environment-check`; anonymous `GET /api/user-usage`, `GET …/pptx/themes`, `POST …/pptx`, `POST …/pptx/artifact` return **401**; cron returns **401** in all three attempts. `POST /api/lesson-plan` returns 400 for an invalid body *before* authentication (shape validation only); `authenticateRequest` runs before any provider call (checked in source), so no paid call is reachable anonymously. `GET /api/super-admin/me` anonymously returns `{"isSuperAdmin":false}` by design.
**Observations, not fixed:**
- Console: `vercel.live/_next-live/feedback/feedback.js` is blocked by CSP on Preview. Only the Vercel comment widget is affected; the deferred toolbar-CSP commits (§3E) address exactly this. Cosmetic.
- `/login` stays light under `prefers-color-scheme: dark` emulation, while the landing page and app follow the theme. Not investigated whether this is intended.
Screenshots: `docs/release/screenshots/live-login-dark.png`, `live-landing-mobile.png`.

## Not verified (blocked)
- **Authenticated flows** (login, dashboard, saved lessons, school navigation, logout, cache isolation, command palette, mobile drawer and swipe on the *live* build, safe-area on a device): no authorized staging test session is available to automation and no credentials were retrieved. The earlier mock-auth coverage does **not** count as live verification.
- **Gamma PPT:** code-level only (integration present, `gammaKeyPresent: true`, provider `gamma`, theme and artifact routes enforce auth). **No real Gamma export, artifact reuse or private download was exercised**, and no paid call was made. Student-instruction slides, required illustrations and speaker notes are verified in source and tests, not in a real exported deck.
- **Cross-user isolation on live data:** needs two staging accounts.
- **Staging database and Phase 2:** not inspected. Migration `20261025120000_phase2_rpc_and_school_policy_hardening.sql` is **still pending** (not applied; needs separate approval) and the DB-backed isolation tests have not run, so staging must not be called secure.

## Verdicts
- **Staging deployment: GO — done.** Live, correct SHA, correct domain/project/Supabase, no regression visible in anonymous checks.
- **Staging "fully verified / secure": NO-GO** until the authenticated smoke checklist, one approved real Gamma export (plus reload and re-download without a new credit), and the Phase 2 catalog inventory, migration and isolation tests are done.
- **Production readiness: NO-GO.** `CRON_SECRET` missing in Production, Phase 2 unapplied and unverified, shared production keys in the Preview scope, authenticated and paid paths unverified.

## Rollback (staging only)
1. Instant: `vercel alias set project-scquo-m84u5g9ix-teacher-app.vercel.app staging.layah.in --scope teacher-app` re-points the domain to `dpl_8V2X3ksNWZHahboQKwNmybPFAz4C` (the `052d638` build); or use the dashboard's Assign Domain on that deployment. A later push to `staging` moves the alias again.
2. Durable (Git): `git revert -m 1 d5baea8` and `git revert -m 1 5fa06b9`, plus reverts of `32d24d7`, `a24804a`, `a18abb0`, pushed as a normal fast-forward. Never force-push.
3. Production and `main` are not involved.

---
*The sections below were written before deployment and are kept as the audit trail.*

## Recommendation

| | |
|---|---|
| **Deploy this code to staging (Preview)** | **CONDITIONAL GO** — after the three operator checks in "Before deploying" below. Code is green, merges are textual and semantic clean, no new env vars are required for staging, no database change is needed for the code to run. |
| **Declare the unified staging environment complete / secure** | **NO-GO (not yet).** The staging database was not inspected, the Phase 2 migration is unapplied, the DB-backed isolation tests have not run, no paid-provider flow was exercised, and nothing is deployed yet. |
| **Promote anything toward production** | **NO-GO.** `CRON_SECRET` is unset in Production (Phase 1 blocker) and Phase 2 is unverified. |

## 1. Deployment target (verified vs inferred)

| Fact | Status | Evidence |
|---|---|---|
| Canonical hostname is **`https://staging.layah.in`** (no `www`) | **Verified** | App self-reports `siteUrl: https://staging.layah.in`, `siteUrlMatchesRequestOrigin: true`. `www.staging.layah.in` resolves in DNS but fails TLS (`SEC_E_WRONG_PRINCIPAL`) — it is not a configured domain. **The `www.staging.layah.in` hostname in the brief should be corrected.** |
| It is the isolated environment | **Verified** | `/api/environment-check`: `isolated: true, ok: true`, `environmentName: staging`, `supabaseRef: esqnyktumxscyvznftlc`, `liveRazorpayKeyPresent: false`, `vercelEnv: preview`, Gamma enabled, `gammaKeyPresent: true`. |
| Vercel project | **Verified (repo link)** | `project-scquo`, team `team_lVy7Ue68QA5NP4WTo7JMCqrU` (`.vercel/repo.json`). |
| Git SHA currently served | **Inferred, NOT confirmed** | Newest GitHub deployment is Preview `7315067338` for `052d638` (2026-10-25 15:21 UTC). The app does not expose its commit and Vercel was not reachable (CLI not installed, MCP unauthorized), so the alias→deployment mapping is unproven. |
| Which branch the domain follows | **Unknown — must check** | Deployments exist for both `staging` and `experiment/gamma-ppt-integration` (same SHA today). If `staging.layah.in` is bound to the *experiment* branch, pushing `staging` will not update it. |
| Production hosts (for contrast) | Verified | `www.layah.in` → 200; `layah.in` → 307 to `www`. Untouched. |

## 2. Branch / worktree inventory (all preserved)

| Branch (worktree) | Tip | Relation to `origin/staging` | Disposition |
|---|---|---|---|
| `origin/staging` | `052d638` | — | **Base.** |
| `experiment/gamma-ppt-integration` (`teacher-app-gamma-experiment`) | `052d638` | identical | Already included. |
| `main` / `origin/main` | `37e3bd7` / `dc955af` | ancestors | Already included. |
| `seo/technical-seo` (`teacher-app-seo`) | `aec9a19` | **ancestor** | **Already in `origin/staging`** (SEO verified on unified build: title, canonical, JSON-LD, OG on `/ /pricing /about /faq`). |
| `ux/staging-modernization` (`teacher-app-ux-modernization`) | `80e8dfd` | +5 | **Merged** (`d5baea8`), clean. |
| `security/phase-1-api-authorization` (`…-security-phase1`) | `0b302c6` | +2 (base `43161a8`) | **Merged via Phase 2** (stacked). |
| `security/phase-2-database-storage` (`…-security-phase2`) | `b7e3185` | +4 | **Merged** (`5fa06b9`), clean; includes the SQL migration (unapplied). |
| `staging` (local, diverged) | `74a9784` | 62 ahead / 60 behind, 51 patch-unique | **Preserved untouched.** Curated below. |
| `phase4a-title-starter` (`…-staging-audit`) | `c399da7` | 65 ahead / 60 behind | PPT-phase lineage continuation → **deferred** with the PPT line. |
| `fix/email-confirmation-flow` (`…-auth-pr`), detached `…-auth-confirm` | `dc955af`/`37e3bd7` | ancestors | Already included. |

Trial merges (`git merge-tree`, no refs touched) of `origin/staging` with each of ux / phase1 / phase2 / seo: **0 conflicts**. With local `staging`: **48 conflicting files** → not mergeable wholesale.

## 3. Reconciliation of the 51 patch-unique local-`staging` commits

Method: every commit's changed lines compared with its same-subject twin on `origin/staging`; per-commit conflict simulation against `origin/staging`; feature-presence checks in source.

### A. Superseded — twin exists on `origin/staging` (17) — **not taken**
11 have **identical changed lines** to their twin (`4779de0, 9762d81, f57d9d0, de8ed4f, 3de871e, 3e11c4d, e1260c1, 886d35f, 577bf09, 09a14b0, e17c854`). 6 differ in detail (`d0d5360, 87d9048, 2f2c441, 3c4dff0, 7332381, b776ab2`): for `87d9048`, `2f2c441` and `b776ab2` the twin changes noticeably more lines (259 vs 184, 92 vs 68, 196 vs 23); for `d0d5360` the counts match (552 each) and for `3c4dff0`/`7332381` the local variant is marginally larger (139 vs 130, 61 vs 59). I compared line counts only, not semantics, so for these six the claim is "the main-line twin is what `origin/staging` runs and is the later, tested version", not "provably a superset". Low risk, listed for transparency. These were rebased copies of main-line work.

### B. Integrated (3) — still required, absent from `origin/staging`
| Commit → new SHA | Why |
|---|---|
| `084d426` → `32d24d7` telemetry from production only | Without it staging reports into the **production** PostHog/Sentry projects and tags staging errors `production`. Verified after merge: no outbound PostHog/Sentry/`/ingest` requests from a non-production host and `window.posthog` is undefined (only the SDK JS chunks load). |
| `7c18151` → `a24804a` Sentry client init → `instrumentation-client.ts` | `084d426` alone is ineffective: `sentry.client.config.ts` is not the client entry on Next 16. |
| `889d6d3` → `a18abb0` library: lesson contents strip + recency bands | Real user feature missing upstream (14 new tests). Its `app-frame.tsx` hunk (a collapsed-rail theme-toggle fix) targeted the old revamp layout and was **dropped**; `origin/staging` already has the theme toggle in the header and drawer. |

### C. Superseded by main-line revamp (5) — not taken
`ddfb94f, 10d31ef, c18c0a9, 8ffe0db` (56-file "frontend revamp"), `e7bcf11` (52-file "polish pass"): a parallel revamp of the same screens that `origin/staging` already received through main (`app-frame`, palette, tokens, route skeletons). Taking it would overwrite the newer, security-reviewed files (23 conflicts for `8ffe0db` alone). Its SEO/favicon/mobile content is covered by the SEO branch and the UX branch.

### D. Incompatible — deliberately **not** taken (1)
**`1b4d83c` "stop preview deployments fighting production over active_sessions".** It turns single-session enforcement into a no-op outside production because Preview used to share production's Supabase. Staging now has its own project (`esqnyktumxscyvznftlc`), so the premise is gone, and applying it would **weaken an existing security control** on the environment meant to test it. (It also renames `telemetry-env.ts`; the unrenamed file is used.)

### E. Deferred — needs a product decision (21)
Toolbar CSP group (`bf0e5a0, 525bb74, 5e3bba9, dca4085`, net effect: allow `vercel.live` on Preview — cosmetic, deferred) and the **PPT design phases 0–4** (`8cb6ce1, 8321e9d, c721cb5, 7bc9820, 553499d, 94283b9, 7c658c3, dde2986, 15ed23b, d33dba7, b07f6d2, 4ca61e8, 81864c8, b8fd77e, b0f5327, 74a9784, bb784b3`) plus its UI hardening (`915f9bf, 3a0c883, 0906629, ee66d27`).
Reason: this is a **second, competing PPT composition lineage** (layout registry / layout budgets / learning-objective layouts) against the education-specific engine already on `origin/staging` (`37e3bd7`) and the Gamma pipeline (Gamma is the staging default provider). The UI commits patch `artifact-workspace.tsx` and `lesson-plan-loading-game.tsx`, **which do not exist on `origin/staging`** (its generation UI is Layah Studio). Individually-clean docs commits are useless without the code and would describe features that are not present, so they were not imported either.
**Decision needed:** keep the main-line engine (recommended — nothing lost on staging) or schedule a dedicated port of the Phase 0–4 layout work with its own test/visual evidence.
Smaller idea worth porting later: `ee66d27`'s synchronous in-flight ref that closes the same-render double-click gap on paid generation (server-side gate already limits damage).

## 4. Feature verification against source (not assumed)

| Requested item | Result | Evidence |
|---|---|---|
| Gamma PPT integration | **Present** | `src/lib/gamma/*` (client, payload, validate, render, store, recovery, gate, themes, artifact), routes `export/pptx` + `/artifact`; unit tests pass. Live store integration test **skipped** (needs the staging DB). |
| Student-facing activity instructions | **Present** | `physicalKind: "activity-instructions"` slides in `gamma/visual-plan.ts`, payload rules in `gamma/payload.ts`, `ppt-main-phase-activity.test.ts`. |
| Speaker notes / content-quality fixes | **Present** | `gamma/notes.ts`, `ppt-slide-guards`, `ppt-post-generation`, `ppt-educational-quality` tests pass. |
| Required educational images | **Present** | `ppt-visual-intent.ts` (`REQUIRED_VISUAL_DECK_INDEX`), `gamma/visual-plan.ts`, `picture-medium.ts`, `ppt-live-deck-evidence.test.ts` (**skipped**, live). |
| PPT generation loading experience | **Present** | `generation-studio/` — stages from real signals only, no timers or invented percentages. |
| UI modernization | **Merged** | See `docs/ui/staging-ux-modernization-report.md`. |
| Security Phase 1 (API authorization) | **Merged** | Cron bearer auth (fail-closed), school-register / enrollment authz, `api-authorization` tests. |
| Security Phase 2 application code | **Merged** | Gamma artifact reads require owner folder (`readGammaArtifact(userId, path)`). Works without the migration. |
| SEO | **Already upstream** | verified on unified build. |
| Incomplete | — | PPT phase 0–4 line (deferred), toolbar CSP (deferred), live Gamma/DB/storage verification (not run). |

## 5. Database and environment (Step 3) — BLOCKED for live inspection

- **No legitimate access path to the staging database from this machine**: no Supabase CLI, no `psql`, staging values are Sensitive in Vercel and not retrievable, local `.env.local` files point at a *different* project (masked `jbwe…wnjt`) and were deliberately not used. Therefore the **actual schema, migration history, RLS state, function grants, storage policies and Gamma tables of staging were NOT inspected.** Nothing here claims otherwise.
- **Pending SQL (not applied, awaiting authorization):** `supabase/migrations/20261025120000_phase2_rpc_and_school_policy_hardening.sql` — revokes anon/authenticated EXECUTE on `refund_user_generation`, restricts usage RPCs to authenticated/service_role, drops the wildcard-matching `school_admin_update_teacher_role` policy and UPDATE grant. All statements guarded/idempotent, no data read or changed, rollback statements in the file header. Ordering vs existing migrations checked (latest prior `20261023093000`).
- **Read-only verification assets already in the tree** (run in the Supabase SQL editor for `esqnyktumxscyvznftlc` only): `scripts/security/phase-2-catalog-inventory.sql`, `phase-2-isolation-transaction-test.sql`, `saved-lessons-rls-transaction-test.sql`. Run the catalog inventory **first** and review before applying the migration.
- Not verifiable offline: auth settings, school-membership schema, storage bucket privacy / policies, Gamma tables (`20261022120000`, `…23090000`, `…23093000`) being applied, and whether migrations 20261022–20261025 are all in staging's history.
- **Environment variables:** the integrated diff introduces **no new required variable**. `VERCEL_ENV` is injected by Vercel; `NEXT_PUBLIC_SENTRY_DSN` already exists. `CRON_SECRET` is only needed where crons run (Production) and is **missing there** (see Phase 1 doc) — not needed for Preview. No production credentials or service-role keys were copied anywhere.

## 6. Verification results (unified tip `a18abb0`)

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| Vitest (full) | **77 files passed / 4 skipped; 741 tests passed / 11 skipped** (origin/staging baseline + 45) |
| Focused suites (PPTX repair/template, Gamma, PPT quality/guards, export routes, authz, school-register, auth, cron, HOD, cache, telemetry, lesson grouping/contents, environment isolation) | 29 files / **276 passed**, 8 skipped |
| ESLint | 0 errors, 72 warnings (baseline) |
| `next build` | passes (placeholder `NEXT_PUBLIC_SUPABASE_*` supplied on the command line; real env not used) |
| Secret scan (regex over tracked files) | no real secrets; hits are test fixtures (`rzp_live_abc123`) and the code that *detects* live keys. No `.env*` tracked other than `.env.example`. |
| Migration compatibility | new migration sorts after all existing, no DROP TABLE/TRUNCATE/DELETE, guarded. **Not run against a live database.** |
| PPTX structure | `pptx-repair`, `pptx-template`, Gamma `canonical-deck`/`validate` tests pass (structure validated offline; **no real PowerPoint-open test, no live Gamma export**). |
| Browser (mock-auth harness on the unified build, temporary files removed) | Public SEO pages OK; palette Ctrl+K open/Esc; **account switch showed no cross-user content**; logout left no user content in the DOM; drawer opens, **focus trap 0 escapes**, Esc closes, focus restored; header 99 px (52 + 47 safe-area); dark mode renders; no app console errors. |
| **Drawer swipe on the unified build** | **NOT re-verified.** Synthetic touch input stopped reaching the page in this browser session (even window-level listeners saw nothing, also on a fresh tab). The swipe code and drawer markup are **byte-identical** to the UX branch (0 differing lines) where it passed all cases, so no regression is expected — but a manual swipe on the deployed staging is required. |
| Real-account flows (signup/login, school registration, lesson generation, saved lessons, downloads, worksheets, AFL) | **Not run** — no authenticated session or test credentials available to automation (credential reads were refused by policy); no paid calls made. |

## 7. Before deploying (operator checks — need your hands)

1. **Vercel → project-scquo → Domains:** confirm `staging.layah.in` is assigned to the **`staging`** branch (or tell me it follows `experiment/gamma-ppt-integration`) and note the currently-live deployment ID to confirm it is the `052d638` build.
2. **Authorize the push** of `release/unified-staging` to `origin/staging` as a **fast-forward** (it is a descendant; no force needed): `git push origin release/unified-staging:staging`.
3. Decide on the PPT-phase line (§3E) — does not block this deploy.

## 8. After deploying — rollback

1. Fastest: Vercel dashboard → previous Preview deployment `7315067338` (`052d638`) → **Promote/Assign domain** to `staging.layah.in` (no git change).
2. Git: `git revert -m 1 <merge sha>` for the merges (`d5baea8`, `5fa06b9`) and `git revert` for the three cherry-picks — never force-push.
3. Database: nothing applied yet. If the Phase 2 migration is later applied and a legitimate flow breaks, use the ROLLBACK grants in the migration header.
4. Local `staging` and every other branch/worktree remain as they are.

## 9. Real staging smoke tests

See `docs/release/staging-smoke-test-checklist.md`. Paid-provider steps (Gamma, DeepSeek, fal.ai) are **pending explicit approval**.

## 10. Known limitations
- Alias→SHA mapping and branch binding of `staging.layah.in` unconfirmed.
- Staging DB state unknown; Phase 2 security work is code-ready but **unverified live**.
- Only mock-auth browser coverage; swipe not re-run on the unified build.
- 21 local-staging commits (PPT phases, toolbar CSP) intentionally not integrated.
- `/landing` now 308-redirects to `/` (SEO branch behaviour, already upstream).
