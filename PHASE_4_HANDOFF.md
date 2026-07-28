# Phase 4 handoff — reserve-and-refund, fail-closed usage gate

**Status: IN PROGRESS, not yet started editing.** This file exists so that if
the current session runs out of context mid-phase, a fresh agent (or human)
can pick up exactly where it left off with zero re-derivation. Delete this
file once Phase 4 is committed and Phase 5 is underway — it's a scratch
handoff doc, not permanent project documentation. If you are a fresh agent
reading this: read it fully before touching any code, then update the
"Progress log" section at the bottom as you complete each step.

## How we got here

This is Phase 4 of a 5-phase security/revenue-integrity pass on the Layah
codebase (`c:\Liyaah\teacher-app`, Next.js 16 + Supabase + DeepSeek AI SaaS).
The full plan lives at `C:\Users\Uvais\.claude\plans\so-give-me-an-twinkling-hummingbird.md`
(may have been overwritten by a later planning session — if so, this handoff
doc plus the git log are the authoritative record). The user's memory files
at `C:\Users\Uvais\.claude\projects\c--Liyaah-teacher-app\memory\` have the
full changelog of Phases 0-3, but the short version:

- **Phase 0** (commit `ce2c177`): deleted 4 unauthenticated cost/data-leak
  routes, added auth to others, added server-side page auth gates, fixed SMTP.
- **Phase 1** (commit `81d4f4a`): added vitest, pinned current behavior with
  tests (limit arithmetic, UTC reset dates, pricing regions).
- **Phase 2** (commit `1537874`): created `src/lib/plans.ts` as the single
  plan/limit registry, collapsed 8+ duplicate definitions into it.
- **Phase 3** (commit `e4dc5ad`): added `supabase/migrations/20260728120000_usage_gate_functions.sql`
  — purely additive SQL (new `security definer` RPCs: `ensure_user_usage()`,
  `consume_user_generation()`, `refund_user_generation()`, plus
  `plan_generations_limit()` as the SQL-side source of truth). **Nothing in
  the deployed app calls these yet.** Also added `tests/sql-plan-parity.test.ts`
  which cross-checks the SQL function's numbers against `src/lib/plans.ts`.

**The core problem Phase 4+5 fix:** the app currently gates AI generation
with a check-then-act pattern that (a) isn't atomic — concurrent requests can
all pass the limit check before any of them increments the counter, and (b)
can be bypassed entirely, because `user_usage` currently grants `authenticated`
direct `UPDATE`/`INSERT` on the table via RLS policies that restrict *which
row* but not *which column* — any logged-in user can `PATCH` their own
`plan_type` to `pro_plus` via the public Supabase anon key. Phase 4 switches
the app to use the new atomic RPC (reserve before spending money, refund on
failure) and makes the gate fail-closed. **Phase 5** (not this phase) applies
the actual RLS lockdown that closes the bypass — it must come after Phase 4's
app change is deployed and verified, and after the two browser-side
`user_usage` writes are deleted (they'd break under the lockdown).

## Ground rules for this session (from the user)

- User said: "just an engineer," cannot make payment/business decisions.
  **Never suggest a paid service** (Upstash, paid tiers, etc.) unless
  truly unavoidable — everything here uses only Supabase/Vercel/vitest,
  already configured, free.
- App is **not live yet** (no real users) — so no need for the extremely
  cautious canary/rollback choreography a live app would need, but still
  write real rollback steps since they're cheap insurance (already done in
  the Phase 3 migration file).
- Every phase so far: made the code change, ran `npm run typecheck && npm run
  lint && npm run test && npm run build`, did a live smoke test against
  `next dev` (start it, curl the affected routes/pages, kill it), then
  committed with a long descriptive message, then logged the phase to memory
  at `C:\Users\Uvais\.claude\projects\c--Liyaah-teacher-app\memory\project-layah-changelog.md`.
  **Follow the same pattern for Phase 4.**
- Dev server runs on port 3001 (`npm run dev` — already configured
  `next dev -p 3001`). If `EADDRINUSE`, find and kill the stale process
  first: `netstat -ano | grep ":3001" | grep LISTENING`, then
  `powershell -Command "Stop-Process -Id <pid> -Force"`.
- Windows/PowerShell environment but Bash tool is Git Bash — use POSIX
  syntax in Bash tool calls (see repo's general environment notes).
- CRLF line-ending warnings from git on every edit are expected/harmless
  (`.gitattributes` normalizes on next touch) — do not try to "fix" them.

## Exactly what Phase 4 must do

### 1. Rewrite `src/lib/user-usage-server.ts`

Current full file was read and is reproduced in the conversation this
handoff was written from; re-read it fresh before editing, it's ~493 lines.
Key facts about it:

- `getSupabaseForUser`, `getBearerToken`, `authenticateRequest`,
  `logExactSupabaseError`, `getOrCreateUserUsage` — **keep these, unchanged
  signatures.** `authenticateRequest` in particular is used by ~17 route
  files and must not change shape.
- `insertDefaultUsage`, `applyMonthlyResetIfNeeded` — **delete**. Superseded
  by the new `ensure_user_usage()` RPC (Phase 3). Currently these write via
  the **user's JWT client**, which is one of the reasons the RLS lockdown in
  Phase 5 would otherwise break things.
- `ensureUserUsageRecord` — **rewrite** to call
  `supabase.rpc("ensure_user_usage")` instead of manual select→insert→reset.
  The RPC returns a `jsonb` shaped like
  `{outcome, user_id, plan_type, generations_used, generations_limit, reset_date, created_at}`
  (see migration file `supabase/migrations/20260728120000_usage_gate_functions.sql`
  section 4, `usage_row_json`). Need to normalize that jsonb payload back into
  a `UserUsageRow` (via `normalizeUsageRow` from `@/lib/user-usage`) for
  callers like `getOrCreateUserUsage` to keep working unchanged.
- `verifyAuthenticatedUserId`, `runUsageIncrementUpdate`,
  `incrementGenerationsUsed` — **delete entirely**. Superseded by the new
  RPC calls. The RPC derives identity from `auth.uid()` inside the caller's
  JWT — no `userId` parameter can be spoofed, which was a real (if minor)
  gap in the old code (it did check `user.id !== userId` but that check is
  now structurally unnecessary).
- **New: `reserveGeneration(supabase, userId)`** — replaces `assertCanGenerate`.
  Calls `supabase.rpc("consume_user_generation")`. The RPC's `outcome` field
  is `'incremented' | 'limit_reached' | 'unlimited'`.
  - `'limit_reached'` → return the existing `GenerationGateResult` shape with
    `ok: false, status: 403, code: GENERATION_LIMIT_ERROR_CODE, message, usage`
    (message format matches today: `` `You have used all ${limit} generations for this month.` ``).
  - `'incremented'` → `ok: true, usage` (already reflects used+1) **plus a
    new `reservation: { userId, resetDate }` field** the caller must pass to
    `refundGeneration()` if the paid AI call afterward fails.
  - `'unlimited'` → `ok: true, usage, reservation: null` (nothing to refund
    for unlimited plans).
  - On any RPC error (network, `42883` function missing, `42501` permission,
    etc.) → call a new `handleGateFailure` helper (see fail-closed section
    below) instead of the old fail-open behavior.
  - **Need to update the `GenerationGateResult` type** to add the optional
    `reservation` field on the `ok: true` branch, and probably a new
    `USAGE_CHECK_UNAVAILABLE_CODE` export for the 503 case (see below).
- **New: `refundGeneration(reservation: {userId, resetDate} | null)`** — no-op
  if `reservation` is null (unlimited plan, nothing was consumed). Otherwise
  uses `getSupabaseServiceRole()` (from `@/lib/supabase-admin`, already
  imported in this file) to call
  `admin.rpc("refund_user_generation", { p_user_id: reservation.userId, p_reset_date: reservation.resetDate })`.
  Log a clear `[usage-gate] REFUND SKIPPED` warning if the service role
  client is null (env var missing) rather than throwing — a missing refund
  should never crash the error-handling path that's already reporting a
  failed generation to the user.
- **`recordSuccessfulGeneration`** — since the increment already happened at
  reserve time, this becomes a much simpler function. Decide the exact new
  signature by looking at both call sites (lesson-plan and question-paper
  routes) — as of this handoff being written, both call it as
  `recordSuccessfulGeneration(auth.supabase, auth.userId, auth.accessToken)`
  and use the returned `UserUsageSnapshot | null` to attach `usage` to the
  JSON response. The cleanest fix: since `reserveGeneration`'s return already
  has the up-to-date `usage` snapshot (post-increment), the route handlers
  don't need to call anything after a successful generation — just reuse
  `gate.usage` directly in the response instead of calling
  `recordSuccessfulGeneration` at all. That's simpler than keeping a shim
  function around. **Decide this when editing, and delete
  `recordSuccessfulGeneration` if it becomes unused, updating both route
  files to use `gate.usage` instead.** (Double check no other file imports
  `recordSuccessfulGeneration` — as of Phase 3 only `lesson-plan/route.ts`
  and `question-paper/route.ts` do; verify with
  `grep -rn "recordSuccessfulGeneration" src/`.)
- **Fail-closed helper**, roughly:

  ```ts
  const FAIL_OPEN = process.env.USAGE_GATE_FAIL_OPEN === "true"; // break-glass, default false

  export const USAGE_CHECK_UNAVAILABLE_CODE = "USAGE_CHECK_UNAVAILABLE";

  function handleGateFailure(userId: string, error: PostgrestError): GenerationGateResult {
    console.error("[usage-gate] USAGE_GATE_FAILED", {
      userId, code: error.code, message: error.message, hint: error.hint, failOpen: FAIL_OPEN,
    });
    // Sentry is already a dependency (@sentry/nextjs) — check how it's
    // imported elsewhere in the codebase (e.g. src/app/error.tsx from the
    // stabilization pass) and use the same import style.
    Sentry.captureException(new Error(`usage gate failed: ${error.message}`), {
      tags: { area: "usage_gate", pgcode: error.code ?? "unknown" },
    });
    // Reuse the EXISTING in-memory rate limiter (src/lib/rate-limit.ts,
    // checkRateLimit) to throttle the alert email to once per hour — do NOT
    // add a new dependency for this.
    if (checkRateLimit("usage_gate_alert", 1, HOUR_MS).ok) {
      void sendEmail({
        to: "info@layah.in",
        subject: "Layah ALERT — usage gate failing",
        text: `consume_user_generation failed.\ncode=${error.code}\n${error.message}\nfailOpen=${FAIL_OPEN}\n${new Date().toISOString()}`,
      });
    }
    if (FAIL_OPEN) {
      return { ok: true, usage: defaultFreeUsageSnapshot(), reservation: null, checkSkipped: true };
    }
    return {
      ok: false, status: 503, code: USAGE_CHECK_UNAVAILABLE_CODE,
      message: "We could not check your plan just now. Please try again in a moment.",
      usage: defaultFreeUsageSnapshot(),
    };
  }
  ```

  Verify `sendEmail` and `checkRateLimit`/`HOUR_MS` are importable here
  without a circular import (`send-email.ts` and `rate-limit.ts` are both
  leaf modules with no dependency on `user-usage-server.ts`, so this should
  be safe — but check `send-email.ts`'s imports to be sure it doesn't import
  anything from `user-usage-server.ts` or `user-usage.ts`).

  **Why fail-closed, briefly** (full justification already in the approved
  plan / Phase 3 commit message): a request can't even reach the gate unless
  `authenticateRequest` already made a successful Supabase round-trip
  moments earlier — so "Supabase is down" mostly can't reach this code path.
  What fail-open actually did was convert ANY bug in the usage-gate code
  itself into silent, unmetered DeepSeek/fal spend forever. The client-side
  generator components only show the "upgrade" modal on `403 +
  GENERATION_LIMIT_REACHED` (verify this claim by grepping
  `GENERATION_LIMIT_REACHED` in `src/components/lesson-plan/lesson-plan-generator.tsx`
  and `src/components/question-paper/question-paper-generator.tsx` before
  relying on it) — a 503 with a different code falls through to the normal
  retryable-error UI path with **no client-side change needed**.

### 2. Update `src/app/api/lesson-plan/route.ts`

As of Phase 3, this file (around line 625-790) has:
- Line ~698: `const gate = await assertCanGenerate(auth.supabase, auth.userId);`
  → becomes `const gate = await reserveGeneration(auth.supabase, auth.userId);`
  (rename the import too — check the top-of-file import block, currently
  `import { assertCanGenerate, authenticateRequest, recordSuccessfulGeneration } from "@/lib/user-usage-server";`).
  **Also update the `!gate.ok` branch** — it currently only handles the
  paywall 403 shape; it should still work as-is for the 403 case since the
  shape (`status`, `code`, `message`, `usage`) is unchanged, but note it will
  now ALSO receive the fail-closed 503 case through the exact same branch
  (same `ok: false` shape) — verify the response JSON still makes sense for
  a 503 (the `upgradePitch` field is harmless but slightly odd on a 503;
  leave it, don't over-engineer a special case unless it looks actually
  wrong when tested).
- Two call sites of `recordSuccessfulGeneration` (streaming path ~line 751,
  non-streaming path ~line 780) — replace with `gate.usage` directly (see
  decision above), OR keep a thin shim if that turns out cleaner once you're
  looking at the actual diff. Either is fine; prioritize keeping the JSON
  response shape (`{ ...payload, ...(usage ? { usage } : {}) }`) identical
  for the client.
- **Add refund on failure**: the `catch (e)` blocks in both the streaming
  path (`send({ type: "error", ... })`, ~line 757-759) and the non-streaming
  path (~line 786-788) must call
  `await refundGeneration(gate.reservation)` **before** returning/sending the
  error, so a failed DeepSeek call doesn't cost the user a generation. This
  is the behavior-preserving part of the whole change — today a failed
  generation already costs nothing (increment only happens after success);
  reserve-and-refund must preserve that property.
  Import `refundGeneration` alongside `reserveGeneration`.
- Also check the file's `getUpgradePitch` import (added in Phase 2) still
  makes sense — it should, unrelated to this change.

### 3. Update `src/app/api/question-paper/route.ts`

Same shape of change:
- `assertCanGenerate` at ~line 71 → `reserveGeneration`.
- `recordSuccessfulGeneration` at ~line 124 → `gate.usage` (or shim).
- **Refund on failure**: two failure branches around lines 112 (`if ("error"
  in ds)`) and 119 (`if (!parsed.questionPaper?.trim())`) both currently
  return a 502 **without ever having incremented anything** (today's
  increment happens later, after these checks pass) — under reserve-and-
  refund, the reservation now happens *before* these checks (at the top,
  where `assertCanGenerate`/`reserveGeneration` is called), so **both of
  these 502 branches must now call `await refundGeneration(gate.reservation)`
  before returning**, since a reservation was already taken.

### 4. Verify, in this order

1. `rm -rf .next && npm run typecheck` — must be clean.
2. `npm run lint` — 0 errors, same ~75 pre-existing warnings (do not
   introduce new ones; if a new unused-import warning appears from deleted
   functions, remove the unused import).
3. `npm run test` — should still be 72 passed (Phase 4 doesn't add new pure
   modules to test, since the reserve/refund logic touches Supabase and
   can't be unit tested without mocking — that's fine, this phase relies on
   the live smoke test instead, matching the pattern used for the route
   changes in Phase 0).
4. `npm run build` — must succeed, and check the route list shows the same
   `ƒ`/`○` markers as before (no accidental static/dynamic flips).
5. **Live smoke test** — start `npm run dev` in the background (kill
   whatever's on port 3001 first if `EADDRINUSE`), then:
   - Logged out: `curl -s -X POST http://localhost:3001/api/lesson-plan
     -H 'content-type: application/json' -d '{}'` → should still 400 on
     missing fields, or eventually 401 without a bearer token (same as
     before Phase 4 — this phase doesn't change auth, only what happens
     after auth+quota-check).
   - Confirm `npm run build`'s output doesn't show `/api/lesson-plan` or
     `/api/question-paper` newly erroring at the type level.
   - **Ideally** (if you have real Supabase test credentials in `.env.local`
     already, check if the user has ever set up a test account) log in via
     the actual UI at `http://localhost:3001/auth` and generate one lesson
     plan end-to-end to prove the reserve→success and reserve→refund paths
     both work. If no test credentials exist, it's acceptable to rely on
     typecheck+build+careful code review for this phase, same as how
     Phase 3's SQL migration was verified via its own SQL Editor snippets
     (which need the user to actually run them in the Supabase dashboard —
     **that migration has NOT been applied to the live database yet as of
     this handoff; Phase 4's code changes will not work against a live DB
     until the user applies migration 1 in the Supabase SQL Editor**. Tell
     the user this explicitly when Phase 4 is done, and remind them again
     before Phase 5.)
   - Kill the dev server when done:
     `netstat -ano | grep ":3001" | grep LISTENING | awk '{print $5}' | sort -u | while read pid; do powershell -Command "Stop-Process -Id $pid -Force"; done`

### 5. Commit

Follow the exact style of the previous 3 phase commits (`git log --oneline
-5` to see them) — long descriptive body explaining what changed and why,
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer. Stage with
`git add -A .` (obsidian-vault is gitignored, this is safe) then commit.

**Explicitly mention in the commit message**: migration 1
(`20260728120000_usage_gate_functions.sql`) must be applied in the Supabase
SQL Editor before this code will work against a live/staging database — the
code and the DB migration are both committed to git but the migration itself
is a manual step the user (or whoever deploys) must run once.

### 6. Update memory

Read `C:\Users\Uvais\.claude\projects\c--Liyaah-teacher-app\memory\project-layah-changelog.md`
first (it has entries for Phases 0-3 already, newest at top), then prepend a
new entry for Phase 4 in the same style — what changed, why, what's still
open. Also check
`C:\Users\Uvais\.claude\projects\c--Liyaah-teacher-app\memory\project-layah-goals.md`
in case the "next up" pointer needs updating to say Phase 5 is next.

## Then: Phase 5 (separate step, do not start until Phase 4 is committed)

Phase 5 is the actual paywall-bypass fix — the RLS lockdown migration
(`supabase/migrations/20260728123000_user_usage_lockdown.sql`, not yet
created) plus deleting the two browser-side `user_usage` writes that would
break under it:
- `src/app/dashboard/page.tsx` (~line 60) — client-side `.upsert()` of
  `plan_type`/`generations_limit: -1`. Redundant: `src/app/auth/callback/route.ts`
  already does this server-side with the service role before redirecting to
  `/dashboard`. Just delete the block (and its now-unused
  `schoolPlanResetDate` import).
- `src/lib/user-usage-client.ts` (`ensureUserUsageOnClient`) — switch its
  insert to `supabase.rpc("ensure_user_usage")` instead of a raw insert, or
  determine if it's fully redundant with the server-side `ensureUserUsageRecord`
  path and can be deleted outright (check its callers: `src/lib/auth-post-login.ts`
  as of the earlier codebase review — re-verify before deciding).
- `src/lib/auth-callback-school.ts`'s `upsertSchoolUserUsage` — confirmed
  dead code (zero callers) as of the Phase 2 investigation; delete it and
  its `schoolPlanResetDate` import.
- `src/lib/school-plan-reset-date.ts` — delete the file itself (the
  local-time reset-date bug), and delete the corresponding
  `describe("schoolPlanResetDate — the known-divergent local-time
  duplicate", ...)` block in `src/lib/user-usage-dates.test.ts` (keep the
  rest of that test file — the UTC sanity tests are still valuable).
- Then write the lockdown migration itself — full SQL design is in the
  approved plan file (or re-derive: `revoke all on table public.user_usage
  from public, anon, authenticated; grant select on table public.user_usage
  to authenticated; grant all on table public.user_usage to service_role;`
  plus dropping the `insert_own_usage`/`update_own_usage` policies from
  `supabase/migrations/20260525200000_user_usage_rls_named_policies.sql`,
  keeping `select_own_usage`). Include a rollback block in the same style as
  migration 1.
- Verification for Phase 5 needs the actual bypass-proof curl command
  (PATCH `/rest/v1/user_usage` with the anon key + a real user's access
  token, before/after) — this requires a real Supabase project and a real
  logged-in user, so it may need to be a set of instructions for the user to
  run themselves rather than something this agent can execute directly
  (no real Supabase credentials are available in this environment beyond
  whatever's in `.env.local`, and even those point at a real project the
  agent shouldn't blindly mutate without the user watching).

## Progress log

*(Update this section each time you complete a step. Fresh agent: start
here to see what's already done.)*

- 2026-07-28: Phase 4 **DONE**, committed. All steps completed as designed:
  - `src/lib/user-usage-server.ts` rewritten: deleted `insertDefaultUsage`,
    `applyMonthlyResetIfNeeded`, `verifyAuthenticatedUserId`,
    `runUsageIncrementUpdate`, `incrementGenerationsUsed`,
    `recordSuccessfulGeneration`, `assertCanGenerate`. Added `callUsageRpc`
    (shared helper), rewrote `ensureUserUsageRecord` to call the
    `ensure_user_usage` RPC, added `reserveGeneration` (replaces
    `assertCanGenerate`), `refundGeneration`, `handleGateFailure` (fail-closed
    503 + Sentry + rate-limited alert email + `USAGE_GATE_FAIL_OPEN`
    break-glass env var). `GenerationGateResult` now has a `reservation`
    field on the `ok:true` branch and a `USAGE_CHECK_UNAVAILABLE_CODE` for
    the `ok:false` branch. `authenticateRequest`, `getSupabaseForUser`,
    `getBearerToken`, `getOrCreateUserUsage`, `logExactSupabaseError` all
    kept unchanged (still used by ~17 other route files).
  - Decided **not** to keep a `recordSuccessfulGeneration` shim — both route
    files now use `gate.usage` directly in their success responses, since
    the increment already happened at reserve time. Simpler than keeping a
    pass-through function alive.
  - `src/app/api/lesson-plan/route.ts`: `assertCanGenerate` → `reserveGeneration`
    at the same call site; both the streaming (`send({type:"complete",...})`)
    and non-streaming success paths now use `gate.usage` instead of calling
    `recordSuccessfulGeneration`; both `catch` blocks (streaming ~line 757,
    non-streaming ~line 786) now call `await refundGeneration(gate.reservation)`
    before returning/sending the error.
  - `src/app/api/question-paper/route.ts`: same swap. The two 502 branches
    that already existed (`"error" in ds`, empty `questionPaper`) now both
    call `await refundGeneration(gate.reservation)` first, since the
    reservation is taken *before* these checks under the new flow (it used
    to be that nothing had been "spent" yet at these points — now it has).
  - Verified: `rm -rf .next && npm run typecheck` clean, `npm run lint` 0
    errors / 72 warnings (down from 75 — 3 `DEBUG &&` unused-expression
    warnings disappeared with the deleted functions), `npm run test` 72
    passed (unchanged — no new pure modules added this phase), `npm run
    build` succeeded with the same route dynamic/static markers as before.
  - Live smoke test against `next dev`: confirmed missing-field 400s still
    fire before the auth/usage gate is ever reached (unchanged behavior),
    and page-level auth redirects to `/auth` still work. **Could NOT
    smoke-test the actual reserve→success or reserve→refund RPC paths
    end-to-end**, because (a) migration 1
    (`20260728120000_usage_gate_functions.sql`) has not yet been applied to
    the live Supabase database, so `consume_user_generation` doesn't exist
    there yet, and (b) no test user credentials were available in this
    session to log in and generate a real bearer token. **This is a real
    gap, not just caution** — until the user applies migration 1 in the
    Supabase SQL Editor, calling `/api/lesson-plan` or `/api/question-paper`
    with a valid session will hit `handleGateFailure` and return a 503
    (fail-closed, by design) instead of generating anything. Telling the
    user this explicitly is important — it will look like the app broke
    generation entirely until they run the migration.
  - Committed. Verified no other file references the deleted symbols
    (`grep -rn "assertCanGenerate\|recordSuccessfulGeneration\|incrementGenerationsUsed\|verifyAuthenticatedUserId\|runUsageIncrementUpdate\|insertDefaultUsage\|applyMonthlyResetIfNeeded" src/` returns only a doc-comment mentioning the old name for context, no real references).
  - Memory changelog update: pending as the very next step after this commit.
  - **Next: Phase 5** (RLS lockdown + deleting the two browser-side
    `user_usage` writes). Not started. See the Phase 5 section above for
    the full task list — nothing in it has been done yet.
  - **IMPORTANT reminder for whoever talks to the user next**: tell them (1)
    migration 1 needs to be applied in the Supabase SQL Editor before
    generation will work at all on a real deployment (it will 503 until
    then, which is the correct fail-closed behavior but will look like a
    bug if they're not expecting it), and (2) Phase 5 (the actual RLS
    lockdown that closes the paywall bypass) is still not done — the bypass
    described at the top of this doc is NOT yet fixed.
