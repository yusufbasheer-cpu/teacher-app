# Gamma experiment — code-review remediation

Branch: `experiment/gamma-ppt-integration` (based on `origin/main` @ `dc955af`; not pushed, merged or deployed).
Code commit with the fixes: **`cd3ca43`** (`cd3ca432b11db28b72de6dca71886f0f4621b367`), on top of the original feature commit `065fadf`.
This document is committed separately, so it cites the code commit rather than itself.

No live Gamma call was made. Everything below was verified against mocks (a stateful fake Gamma server with a fake clock) unless it says otherwise.

## Facts established from Gamma's docs (checked 2026-10-22) that drove the design

| Question | Documented answer | Consequence |
|---|---|---|
| Export URL host | **Not documented** (only "anyone with the URL can download for about a week; not tied to your API key") | No default allowlist. Operator must configure `GAMMA_EXPORT_HOST_ALLOWLIST`; checked **before** any paid call |
| Idempotency on create | **Not documented** (no key/header; only the media-archive endpoint is idempotent) | We never assume it. Duplicate protection is entirely ours (ledger) |
| Look up / list generations other than by id | **Not documented** | An unknown create outcome cannot be reconciled with Gamma → quarantine + reserved credits |
| 429 | Documented for agent create with `Retry-After`; rate-limit headers exist, numeric limits not documented | Create retries only on 429, honouring `Retry-After` (capped 10 s, twice) |
| Poll interval / duration | Poll about every 5 s; typically 1–3 min | Per-invocation polling window 120 s, resumable |
| Credits | Returned on the status response (`credits.deducted/remaining`) | Written to the ledger whenever a completed status is seen, including on resume |

## Findings and status

| # | Finding | Status | Where | Regression tests |
|---|---|---|---|---|
| 1 | Timeout releases lock / credits unrecorded → duplicate billing | **Fixed (mock-verified)** | `store.ts`, `render.ts`, `client.ts`, migration | `recovery.test.ts` (resume, unknown outcome ×3, quarantine, reserved credits, definite failure, lost ledger write), `client.test.ts` (create classification) |
| 2 | Export-host allowlist guessed, enforced after spend | **Fixed; needs operator input** | `config.ts`, `client.ts` | `client.test.ts` (host/port/credentials/https/DNS/redirect/type/size/zip/secret-not-leaked), `gate.test.ts` (no default, preflight), `recovery.test.ts` (rejected host ⇒ free retry) |
| 3 | No per-request timeouts | **Fixed** | `client.ts`, `config.ts` | `client.test.ts` (signal on every call; request_timeout / poll_timeout / deadline_exceeded; no create when budget gone) |
| 4 | Prod guard weak; env default can't be opted out | **Fixed** | `config.ts`, route `GET`/`POST`, viewer | `gate.test.ts`, `route.gamma.test.ts` |
| 5 | Rate limit / budgets not persistent, in-flight unaccounted | **Fixed (one documented race)** | `policy.ts`, `store.ts`, migration | `recovery.test.ts` (concurrency, per-user hour/day, daily/monthly budgets, in-flight reserve, fail-closed) |
| 6 | Numeric-only lines dropped as slide numbers | **Fixed** | `validate.ts` | `validate.test.ts` finding 6 |
| 7 | `<a:br>` with children dropped | **Fixed** | `validate.ts` | `validate.test.ts` finding 7 (both forms) |
| 8 | Auto-numbered lists falsely fail | **Fixed for the schemes handled; real-export behaviour unverified** | `validate.ts` | `validate.test.ts` finding 8 (fixtures for `buAutoNum`, `startAt`, restart, 8 label schemes, lost/added/unsupported numbering) |
| 9 | Hard-coded LO index | **Fixed** | `validate.ts` (imports `LEARNING_OBJECTIVES_SLIDE_INDEX`) | `validate.test.ts` finding 9 |
| 10 | Validation warning after download | **Fixed (logic tested; component not render-tested)** | `report.ts`, route headers, viewer `GammaPanel` | `report.test.ts`, `route.gamma.test.ts` |

## How each fix works

### 1. Billing and timeout recovery

State lives in `public.gamma_generations` (service-role only, RLS on, no policies). A **partial unique index allows one active
(`submitting|pending|unknown`) row per user**, so concurrent or duplicate submissions fail atomically in the database, not in process memory.

Flow of `renderPptxWithGamma`:
1. **Settle the ledger first.** If the user has an active row: with a generation id → one status lookup (completed ⇒ record credits, resume if it is the same presentation; failed ⇒ record; still pending ⇒ resume polling if same presentation, else `generation_in_progress`; older than `staleActiveMs` ⇒ `abandoned`). Without an id → blocked as `submission_unknown` until `unknownQuarantineMs`, then `abandoned`.
2. **Undelivered completed generations** (paid, e.g. download rejected) are looked up by user + request hash within 6 days and **resumed with a fresh status call** (a new export link) — no new charge.
3. Only if nothing can be resumed: admission checks (§5) → insert `submitting` row → `POST`.
4. Create outcome: definite failure (400/401/402/403/429 exhausted, budget gone before sending) ⇒ row `failed`, lock freed. **Anything ambiguous (network error, abort/timeout, 5xx, 200 without an id) ⇒ row `unknown`** — the user cannot submit again until the quarantine ends, and the row's credits stay reserved afterwards (`abandoned`).
5. The id is persisted immediately. **After an id exists the row can never be marked failed.** If persisting it fails, the row stays `submitting` (an unknown outcome), the id is written to the server log for manual recovery, and the error propagates.
6. Poll timeout / overall deadline leave the row `pending`; the error message says a retry resumes without a new charge.
7. Credits: written on every observed `completed`/`failed` status, so a resumed or undelivered run is reconciled when it is eventually seen.

### 2. Export URL handling
HTTPS only; no credentials or non-443 port; exact-host allowlist (`*.suffix` for subdomains only); **every** resolved address must be public (RFC1918, loopback, link-local, CGNAT, multicast, mapped IPv6 rejected; DNS failure rejected); redirects refused; content-type must be PPTX/zip/octet-stream; `Content-Length` and the streamed size are capped (50 MB); zip magic bytes; the downloaded file must parse as a PPTX. The signed URL is never logged or put in an error; rejection messages name only the host and say the generation is resumable.

### 3. Timeouts
`requestTimeoutMs` (20 s) aborts one HTTP call → `request_timeout`. `pollTimeoutMs` (120 s) bounds one invocation's polling → `poll_timeout` (job keeps running). `overallBudgetMs` (160 s, from the route's `startedAt`, below the route's 180 s `maxDuration`) → `deadline_exceeded`. Each call's abort timeout is `min(requestTimeout, time left)`. An aborted create is `submission_unknown`, never a retry.

### 4. Production protection
Gamma is available only if **all** hold: `GAMMA_EXPERIMENT_ENABLED=true`; the server names itself via `GAMMA_ENVIRONMENT_NAME`; that name is in `GAMMA_ALLOWED_ENVIRONMENTS`; it is not `production`/`prod`/`live` and `VERCEL_ENV` is not `production`; and the caller's email is on `GAMMA_TESTER_EMAILS`. Missing identity ⇒ disabled. The client sends only a preference: an explicit `"legacy"` always wins, `"gamma"` is honoured only through the gate, junk is ignored, and `PPT_GENERATION_PROVIDER=gamma` is a *server default* applying only to authorised testers. The UI asks `GET /api/lesson-plan/export/pptx` (`{gammaAvailable, defaultProvider}`) and initialises the checkbox from the answer. Email now comes from `authenticateRequest` (additive `email` field), removing the extra auth round trip.

### 5. Limits and budgets (persistent)
Before any paid call: cards ≤ `GAMMA_MAX_CARDS_PER_RUN`; per-user starts per hour/day; rolling-24 h and rolling-30 d credit budgets. Settled spend = credits Gamma reported; every row with unknown cost (in-flight, unknown, abandoned, or completed with no credits figure) and the run being admitted are charged `estimatedCreditsPerRun`. Ledger unavailable ⇒ request rejected (`store_unavailable`). No auto-purchase of credits exists anywhere.

### 6–9. Validator
Slide numbers are removed structurally (`<p:ph type="sldNum">` shapes and `slidenum` fields), never by text length, so `42` survives. Both `<a:br/>` and `<a:br><a:rPr/></a:br>` are line breaks. `buAutoNum` numbering is reconstructed (`arabic|alphaLc|alphaUc|romanLc|romanUc` × `Period|ParenR|ParenBoth|Plain`, with `startAt` and restarts) and prefixed to the paragraph text before comparison. The objectives slide is `LEARNING_OBJECTIVES_SLIDE_INDEX`. Within-slide order is now checked.

### 10. Verdict and UX
`ValidationReport.verdict` is `passed | failed | uncertain`. **failed** = evidence the text changed (missing/modified/unexpected/moved/reordered lines, count, numbers, operators, questions, objectives, a *different* ordered marker for the same text). **uncertain** = no text change found but the checker cannot judge (list numbering missing/added as formatting, unsupported numbering scheme, charts/diagrams/embedded objects). Failed outranks uncertain. In the tester UI the Gamma file is **held** in a persistent panel (not a toast) that shows the verdict, reasons, up to 6 clipped examples, slides/images/credits/generation id and "resumed (no new charge)"; only `passed` offers a normal "Download PowerPoint", otherwise the button reads "Download anyway (…)". The panel stays until dismissed or the next PPT generation starts. Gamma errors have their own panel instead of the template-warning one.

## Files changed since the first Gamma commit

| File | Why |
|---|---|
| `supabase/migrations/20261022120000_gamma_generations.sql` (new) | Ledger + one-active-per-user index (#1, #5) |
| `src/lib/gamma/store.ts` (new) | Store interface, Supabase + in-memory implementations (#1, #5) |
| `src/lib/gamma/policy.ts` (new) | Admission control: cards, per-user limits, budgets (#5) |
| `src/lib/gamma/report.ts` (new) | Header encoding + pure UI decision logic (#10) |
| `src/lib/gamma/config.ts` | Fail-closed gate, provider resolution, timeouts, limits, mandatory allowlist (#2–5) |
| `src/lib/gamma/client.ts` | Timeouts, create-outcome classification, hardened download (#1–3) |
| `src/lib/gamma/render.ts` | Ledger-first orchestration, resume, reconciliation (#1, #5) |
| `src/lib/gamma/validate.ts` | Items 6–9 and the three-way verdict (#6–10) |
| `src/lib/gamma/budget.ts` | **Deleted** (in-memory budget replaced by the ledger) |
| `src/lib/gamma/test-helpers.ts` (new) | Fake Gamma server, fake clock, PPTX builder |
| `src/lib/gamma/*.test.ts` (6 files, new/rewritten) | Regression tests |
| `src/app/api/lesson-plan/export/pptx/route.ts` | `GET` availability, gate via `auth.email`, error mapping, report header (#4, #10) |
| `src/app/api/lesson-plan/export/pptx/route.gamma.test.ts` (new) | Route-level gate and mapping tests |
| `src/lib/user-usage-server.ts` | Additive `email` on `authenticateRequest`'s success result |
| `src/components/lesson-plan/teacher-package-viewer.tsx` | Server-driven toggle, held download + `GammaPanel` (#4, #10) |
| `.env.example` | New variables (placeholders only) |

Untouched: DeepSeek prompts/models/parsing/educational logic, `ppt-structured-lesson.ts`, the legacy renderer and image services.

## Test results (actual)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| Gamma suites: gate 17, payload 3, client 27, validate 30, recovery 27, report 6 | 110 passed |
| Route gate/mapping (`route.gamma.test.ts`) | 21 passed |
| Gamma + route total | **131 passed** |
| Full suite (`npx vitest run`) | **518 passed, 0 failed** (43 files) |
| ESLint on touched files | 0 errors; only warnings that existed before this work, in `user-usage-server.ts` and the viewer |

One real defect was found by these tests during the work and fixed: a lost ledger write after Gamma returned an id originally marked the row `failed` and would have freed the lock for a duplicate paid submission.

## Remaining limitations (not verified or not solved)

1. **No live verification.** Real status/credit field shapes, the real export host and content-type, real `buAutoNum` output from Gamma, and image counts are all unobserved. The first live run must be a minimal smoke test.
2. **Migration not applied** to any database; the Supabase store has no integration test (it is a thin mapper; the in-memory store carries the behavioural tests and mirrors the unique-index rule). Needs `SUPABASE_SERVICE_ROLE_KEY`. If the table is missing the feature fails closed with a message naming the migration.
3. **Cross-user budget race:** the unique index serialises one user only; simultaneous runs by different users can overshoot a budget by roughly one run each.
4. **Response lost after delivery:** the row is marked delivered once the file was downloaded and validated; if the HTTP response then never reaches the browser, the next request is a new paid generation.
5. **Quarantine can block a legitimate user for 30 minutes** after a network blip or any 5xx on create (deliberately conservative).
6. **No cancel/lookup in Gamma's API**, so an `unknown` submission can only be reconciled by an operator using the Gamma dashboard; `abandoned` rows reserve credits permanently within the budget windows.
7. **Failed generations with no credits figure** count as 0; Gamma may in fact bill some.
8. **DNS check is not pinned to the connection** (rebinding would require control of an allowlisted host). Allowlist entries must be verified by an operator.
9. **Validator limits:** text only; similarity for "modified" lines is a 60 % token-overlap heuristic; roman/alpha markers that collide with real text could be misread; chart/diagram text and AI-image correctness are not verifiable. Unknown numbering schemes degrade to `uncertain`, never `passed`.
10. **UI:** `GammaPanel` compiles and its decision logic is unit-tested, but there is no DOM test environment in this repo, so it was not render-tested or exercised in a browser.
11. **`pollTimeoutMs` 120 s** means a generation near the 3-minute mark needs a second request to finish; that second request resumes without a new charge but the tester must click again.
12. `NEXT_PUBLIC_GAMMA_EXPERIMENT` only controls whether the UI *asks*; it grants nothing.

## Before a controlled paid pilot

1. Apply the migration to the **staging** database; set `SUPABASE_SERVICE_ROLE_KEY`.
2. Set the gate variables (§4), `GAMMA_API_KEY`, and a **low** `GAMMA_DAILY_CREDIT_BUDGET`; keep Gamma auto-recharge **off**.
3. Run a 1–3 card smoke test first. If the export host is rejected, the log/panel names it; verify it belongs to Gamma, add it to `GAMMA_EXPORT_HOST_ALLOWLIST`, and retry — no new charge.
4. Compare the logged `creditsDeducted` with the estimates, then size the budgets.
