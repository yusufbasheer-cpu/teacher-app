# Gamma on an isolated staging preview: activation runbook

Branch `experiment/gamma-ppt-integration`. Nothing here has been deployed or paid for. Verified state is in the table; every command below is
safe to copy as written. **Secrets are only ever typed into the Vercel/Supabase prompt or your own shell, never into chat, files or Git.**

## Status update (latest): staging configured and verified; awaiting authorisation to push/deploy

* **Vercel:** 23 branch-scoped Preview variables written for `experiment/gamma-ppt-integration` only (plus the existing `GAMMA_API_KEY`). `node scripts/gamma-vercel-env.mjs --verify` reports 24/24 present. A before/after snapshot of Production and all-branch Preview variable names shows **no change** other than the branch-scoped additions.
* **Limitation:** this Vercel project stores every new variable as *Sensitive* (even `NEXT_PUBLIC_*`), so values cannot be read back and branch-override precedence over the inherited production values cannot be proven before a build. Safety net added in code: Gamma is **refused unless the server's Supabase project is in `GAMMA_ALLOWED_SUPABASE_REFS` (= the staging ref) and is never the production ref**, so a failed override disables Gamma and its ledger instead of touching production.
* **Staging database:** all 44 on-disk migrations applied (`school_templates` and `razorpay_orders_currency` applied this pass, reviewed as additive/idempotent; both recorded in migration history). Ledger integration test re-run after all migrations: 7/7, 0 leftover rows.
* **Tests:** tsc clean; full suite 529 passed, 6 skipped (the staging-only DB tests, run separately: 7/7). A new test drives the **real** export route and **real** legacy renderer (default, tester choosing legacy, ordinary user, production-database server) and gets a valid PPTX each time.
* **DeepSeek unchanged:** only `src/app/api/lesson-plan/route.ts` differs from `origin/main` among content-generation files, by 8 added/3 changed lines (the deck-image skip flag). No prompt, model, parser or educational logic changed.

### Checks to run on the preview after the first deploy, BEFORE anyone logs in (no secrets needed)
1. The page source/JS bundle contains `esqnyktumxscyvznftlc.supabase.co` and **not** `jbwevzvtloahjoamwnjt` (proves the Supabase override won). If the production ref appears: stop; Gamma will already be refusing to run.
2. `GET /api/lesson-plan/export/pptx` without a session returns 401.
3. Logged in as the tester: the same GET returns `{"gammaAvailable":true,"defaultProvider":"gamma"}` (this simultaneously proves the environment name, tester email, database allowlist and provider default took effect).
4. The first ledger row appears in **staging** `gamma_generations`, not production.

## Status update: staging database prepared, Vercel configuration planned (not applied)

| Item | State (verified) |
|---|---|
| `layah-staging` (`esqnyktumxscyvznftlc`) | **ACTIVE_HEALTHY** (resumed by you) |
| Migrations on staging | 43 applied. **Missing: `20260919120000_school_templates`, `20261010120000_razorpay_orders_currency`** (both reviewed: additive/idempotent; **held for your approval**, not needed for the Gamma pilot). `20261022120000_gamma_generations` was **applied** (new table, 4 indexes incl. the partial-unique one-active-per-user, RLS on, **client grants revoked**) and recorded in migration history |
| Ledger integration test on real staging Postgres | **7/7 pass** (atomic insert, 6-way concurrency ⇒ exactly one winner, persistence across instances, resume/undelivered, per-user counts, budget/rate-limit admission, anon RLS). 0 leftover rows |
| Staging auth users | **0**: the tester account does not exist yet |
| Usage-gate functions on staging (`consume_user_generation`, `refund_user_generation`, `ensure_own_user_usage`) | present; free plan may generate PPT |
| `GAMMA_API_KEY` | present, Sensitive, scoped to Preview + branch `experiment/gamma-ppt-integration` only (name verified, value never read) |
| Other branch variables | **not written yet**: `node scripts/gamma-vercel-env.mjs --tester-email <you>` prints the 23-operation dry run; `--apply` writes it |
| Inherited Preview variables | Supabase URL/anon/service-role and live Razorpay keys are bound to ALL previews (prod). The plan overrides them for this branch only |
| Branch pushed | yes (`origin/experiment/gamma-ppt-integration`); **a Vercel preview of it builds automatically with the inherited (production) variables and no Gamma settings: do not log in on that URL** |

Additional findings that change the manual steps:

* **CSRF:** `src/lib/csrf.ts`/`src/proxy.ts` accept browser POSTs only from `layah.in`, localhost, or exactly `NEXT_PUBLIC_SITE_URL`. The plan sets it to the branch URL `https://project-scquo-git-experiment-gamma-ppt-integration-teacher-app.vercel.app` (confirm with `vercel inspect` after the first build).
* **Staging Supabase Auth must allow that origin:** Dashboard → layah-staging → Authentication → URL Configuration → Site URL and Redirect URLs `https://project-scquo-git-experiment-gamma-ppt-integration-teacher-app.vercel.app/**`. (A CLI config push would overwrite unrelated auth settings, so this is manual.)
* **Tester account:** create it on the preview after the above (sign-up + confirm email), or tell me to create a confirmed account with the admin API and send a password-reset email.
* **fal.ai:** with the server default `gamma`, the lesson-plan route now skips the legacy PPT deck image generation for authorised testers only (`src/lib/gamma/legacy-images.ts`, 3-line wiring). Section images and everyone else are unchanged. If the tester picks legacy at download, the legacy export generates images then.
* Local tooling: this worktree is linked to Vercel (local `.vercel`, gitignored) and to the staging Supabase project (`supabase/.temp`, gitignored). `scripts/gamma-apply-migration.mjs` now uses `db query --linked` and refuses unless the linked ref equals the verified target.

## Verified state (checked live, 2026-10-22)

| Item | State |
|---|---|
| Branch tip | `869dcff` + guard-rail commit (see `git log`); tree clean |
| Tests | tsc clean; 518/518 (full suite before the guard-rail commit); 111 Gamma tests pass, 6 DB-integration tests skipped by design |
| Vercel | Authenticated as `yusufbasheer-cpu`, team `teacher-app`, project `project-scquo` (`prj_evS8AChRJBl5N7nY7ZO5ItrBLhg1`). The worktree is not linked yet |
| **Preview env today** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** and the **live Razorpay keys** are bound to **Preview for every branch**. Earlier notes say these point at **production** Supabase (`jbwevzvtloahjoamwnjt`). A plain preview deploy of this branch would therefore hit the production database. **Branch-scoped overrides are mandatory before any deploy** |
| Local `.env.local` | Points at **production** (`jbwevzvtloahjoamwnjt`). Never use it for this work |
| Staging database | Supabase project `layah-staging` (`esqnyktumxscyvznftlc`, Seoul, synthetic data), status **INACTIVE (paused)**. Not touched |
| Migration `20261022120000_gamma_generations.sql` | Reviewed: creates one new table, two indexes (one partial-unique) and enables RLS on the new table. No drops/updates, no foreign keys, idempotent. **Applied nowhere** |
| `GAMMA_API_KEY` | Not available to me, by design |
| Export host | Not documented by Gamma; unknown until a first completed generation |

## What I added (guard rails, no side effects)

* `scripts/gamma-verify-key.mjs`: checks the key via the documented read-only `GET /v1.0/themes`; reads `GAMMA_API_KEY` from the environment, prints only HTTP status, rate-limit headers and theme names. Creates no generation. (Gamma's docs do not say whether listing themes consumes credits.)
* `scripts/gamma-apply-migration.mjs <ref>`: applies **only** this migration file via `supabase db query --project-ref`. Hard-refuses the production ref, any project not named `layah-staging`, and any project that is not `ACTIVE_HEALTHY`. Never uses `db push`. Tested: refuses prod, refuses the currently paused staging project.
* `src/lib/gamma/store.integration.test.ts`: real-Postgres test of the ledger (atomic one-active-per-user under 6-way concurrency, persistence across store instances, resume/undelivered, per-user counts, budget and rate-limit admission, anon-role RLS). Skipped unless `GAMMA_LEDGER_IT=1` **and** the URL is not production.

## Steps (in order)

### 1. Staging database: needs your decision
`layah-staging` is paused. Resuming it is a state change that may cost money depending on the org's plan, so I did not do it.
Resume it in the Supabase dashboard (Project → Restore), then confirm `npx supabase projects list` shows `ACTIVE_HEALTHY` for `esqnyktumxscyvznftlc`.

Then check it is not missing older migrations (the app needs the whole schema, not only the Gamma table):
```
npx supabase db query --project-ref esqnyktumxscyvznftlc "select version from supabase_migrations.schema_migrations order by version desc limit 10;"
```
Compare with `ls supabase/migrations`. Missing earlier migrations must be applied (and reviewed) before the preview can work. I will not apply them blindly.

Apply the Gamma migration (single file, verified target):
```
npx supabase link --project-ref esqnyktumxscyvznftlc   # staging only
node scripts/gamma-apply-migration.mjs esqnyktumxscyvznftlc
```
Prove the ledger on the real database (take the two values from Supabase → layah-staging → Settings → API; type them into your shell only):
```
GAMMA_LEDGER_IT=1 NEXT_PUBLIC_SUPABASE_URL=https://esqnyktumxscyvznftlc.supabase.co SUPABASE_SERVICE_ROLE_KEY=*** npx vitest run src/lib/gamma/store.integration.test.ts
```

### 2. Link the worktree and isolate the preview (branch-scoped Vercel env)
```
cd C:\Liyaah\teacher-app-gamma-experiment
vercel link --yes --project project-scquo --scope teacher-app
```
Branch-scoped overrides (apply only to deployments of this git branch; each command prompts for the value; mark secrets Sensitive):
```
vercel env add NEXT_PUBLIC_SUPABASE_URL      preview experiment/gamma-ppt-integration
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview experiment/gamma-ppt-integration
vercel env add SUPABASE_SERVICE_ROLE_KEY     preview experiment/gamma-ppt-integration --sensitive
```
(values = the **layah-staging** project's URL / anon key / service-role key.) Consider also overriding the Razorpay keys with test-mode keys: the Preview environment currently holds the live ones.

### 3. Gamma key and pilot configuration
Secret location: **Vercel → project `project-scquo` → Settings → Environment Variables → Add**, name `GAMMA_API_KEY`, environment **Preview**, branch `experiment/gamma-ppt-integration`, tick **Sensitive**. CLI equivalent (prompts for the value):
```
vercel env add GAMMA_API_KEY preview experiment/gamma-ppt-integration --sensitive
```
Verify it before any paid call (type the key into your own shell for this one command):
```
$k = Read-Host "Gamma key" -AsSecureString; $env:GAMMA_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($k)); node scripts/gamma-verify-key.mjs; Remove-Item Env:GAMMA_API_KEY
```
Non-secret settings, all scoped to the same branch (`vercel env add NAME preview experiment/gamma-ppt-integration`):

| Variable | Pilot value | Why |
|---|---|---|
| `GAMMA_EXPERIMENT_ENABLED` | `true` | gate |
| `GAMMA_ENVIRONMENT_NAME` | `staging` | explicit server identity (never `production`) |
| `GAMMA_ALLOWED_ENVIRONMENTS` | `staging` | allowlist |
| `GAMMA_TESTER_EMAILS` | your tester addresses | who may use Gamma |
| `PPT_GENERATION_PROVIDER` | `gamma` | **default renderer for those testers**; the checkbox is pre-ticked and can be unticked for legacy |
| `NEXT_PUBLIC_GAMMA_EXPERIMENT` | `true` | build-time: lets the UI ask the server |
| `GAMMA_EXPORT_HOST_ALLOWLIST` | `pending-verification.invalid` | placeholder that matches nothing: see step 5 |
| `GAMMA_USER_HOURLY_LIMIT` / `GAMMA_USER_DAILY_LIMIT` | `2` / `4` | conservative |
| `GAMMA_DAILY_CREDIT_BUDGET` / `GAMMA_MONTHLY_CREDIT_BUDGET` | `600` / `1500` | small pilot; each admitted run is charged `GAMMA_ESTIMATED_CREDITS_PER_RUN` (300) |
| `GAMMA_MAX_CARDS_PER_RUN` | `25` | |
| `GAMMA_IMAGE_MODEL` | unset | let Gamma choose until observed cost says otherwise |

One active paid generation per user is enforced by the database, so no variable is needed. In the Gamma workspace: **leave auto-recharge OFF** (Settings → Billing); nothing in this code buys credits.

The staging Supabase project must contain the tester's account (confirmed email; `mailer_autoconfirm` is false).

### 4. Deploy the isolated preview (no alias, no push)
Only after steps 1–3:
```
cd C:\Liyaah\teacher-app-gamma-experiment
vercel deploy --scope teacher-app
```
This creates a unique preview URL. **Do not** run `vercel alias set` and do not touch `staging.layah.in` or production. `NEXT_PUBLIC_GAMMA_EXPERIMENT` is read at build time, so set it before deploying.

### 5. Paid smoke test (needs your explicit approval), then host verification
With the placeholder allowlist the first generation completes but the download is refused. The error names the real export host and the paid generation stays resumable. Verify that the host belongs to Gamma, then:
```
vercel env rm GAMMA_EXPORT_HOST_ALLOWLIST preview experiment/gamma-ppt-integration --yes
vercel env add GAMMA_EXPORT_HOST_ALLOWLIST preview experiment/gamma-ppt-integration   # the verified host
vercel deploy --scope teacher-app
```
Retrying the same lesson then downloads the already-paid generation: no new charge. Expected observations to record: response schemas, `credits.deducted`, export host and content type, validation verdict, image count.

### 6. Rollback
Untick the toggle (legacy for that download), or set `PPT_GENERATION_PROVIDER=legacy`, or `GAMMA_EXPERIMENT_ENABLED=false`, then redeploy. Deleting the branch-scoped variables removes the experiment entirely. Legacy code was never modified.

## Known gaps that affect the "teacher experience" goal

1. **Slides: 13, not 20.** The real pipeline produces 13 cards; a 20-slide test needs an approved fixture.
2. **Legacy image spend still happens.** The lesson-plan route pre-generates fal.ai/Pexels images at creation, before the renderer is chosen. Gamma mode ignores them, but their cost is incurred. Avoiding it means editing the lesson-plan route; deliberately not done.
3. **Generation can exceed one request.** A deck near 3 minutes needs a second click (it resumes at no cost).
4. **Not render-tested:** the validation panel has no DOM test, and I have not yet done a browser smoke test because no safe backend exists to run the app against (local env points at production).
