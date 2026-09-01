# Backend Wave 1 Investigation — Checkpoint 22

Date: 2026-09-01

## Purpose

With the endpoint-by-endpoint pilot phase complete
(`PREVIEW_TO_PREVIEW_VALIDATED_PILOT_COMPLETE` — `GET /api/geo`,
`POST /api/auth/verify-captcha`), this checkpoint investigated whether a
coherent "Wave 1" batch of additional Next API routes could safely move
to FastAPI using the now-proven infrastructure, before writing any
migration code.

**Conclusion: `NO_SAFE_WAVE_1_COHORT`.** No repository code was changed
this checkpoint. This is a documented, evidence-based finding, not a
skipped investigation — see below for the full classification.

## Method

Per this checkpoint's explicit instruction not to re-audit the
repository, the investigation started from the existing migration audit
(`API_INVENTORY.md`'s complete 84-operation table,
`BACKEND_MIGRATION_MANIFEST.md`'s existing classifications,
`COMPONENT_OWNERSHIP_MATRIX.md`, `SECURITY_AND_MIGRATION_RISKS.md`), then
spot-checked actual route source for every operation whose
inventory-table classification was ambiguous or looked like it might be
a hidden "fourth safe candidate": `/api/hod/me`, `/api/user-usage`,
`/api/account/export`, `/api/cron/subscription-maintenance`,
`/api/welcome-email`, `/api/auth/school-enrollment`.

## Classification

Every one of the ~84 Next API operations was classified against the
Wave-1 safety bar established by the two already-completed pilots (no
Supabase dependency — read or write, no auth/session requirement, no AI
provider, no billing, no admin authorization, no export/file complexity):

| Endpoint / group | Classification | Reason |
| --- | --- | --- |
| `GET /api/geo` | ALREADY_DONE | Pilot 1 |
| `POST /api/auth/verify-captcha` | ALREADY_DONE | Pilot 2 |
| `POST /api/lesson-plan/save` | EXCLUDED | SUPABASE — parity exists, blocked on project-wide RLS source-of-truth (`HYBRID_TRANSITION_REQUIRED`) |
| `POST /api/lesson-plan`, `/api/question-paper`, `/api/question-paper/blueprint`, `/api/differentiated-pack`, `/api/differentiated-pack/infer-meta` | EXCLUDED | AI (DeepSeek) |
| `POST /api/lesson-plan/extract-upload`, `/api/differentiated-pack/extract` | EXCLUDED | AUTH |
| `POST /api/lesson-plan/export/{docx,pptx,zip}`, `/api/question-paper/export/*`, `/api/differentiated-pack/export-*` | EXCLUDED | EXPORT |
| `GET /api/user-usage` | EXCLUDED | SUPABASE, AUTH |
| `GET /api/account/export` | EXCLUDED | SUPABASE, AUTH, EXPORT |
| `DELETE /api/account/delete` | EXCLUDED | SUPABASE, AUTH, ADMIN (destructive, service-role) |
| `POST /api/auth/school-enrollment` | EXCLUDED | SUPABASE, AUTH |
| `POST /api/welcome-email` | EXCLUDED | SUPABASE, AUTH, SMTP |
| `POST /api/contact`, `/api/feedback`, `/api/waitlist`, `/api/school-register` | EXCLUDED | SUPABASE (service-role writes), SMTP — re-classified `NEXT_ONLY` in Checkpoint 18 after source review found the manifest's original "low-risk public form handler" label undersold real dependencies |
| `GET/PATCH/DELETE /api/school-admin/**` | EXCLUDED | ADMIN, SUPABASE, AUTH |
| `GET /api/hod/me` | EXCLUDED | SUPABASE, AUTH |
| `GET/DELETE/POST /api/school-template*` | EXCLUDED | SUPABASE, AUTH |
| `POST/GET /api/razorpay/**` (all) | EXCLUDED | BILLING |
| `GET/POST/DELETE /api/super-admin/**` | EXCLUDED | ADMIN |
| `GET /api/cron/subscription-maintenance` | EXCLUDED | SUPABASE (service-role), SMTP, billing-adjacent state mutation — see note below |

**Total: 84 operations reviewed. 2 already done. 0 additional
SAFE_CANDIDATE. 82 excluded**, each for one or more of: Supabase
(read or write), auth/session, AI provider, billing, admin authorization,
export/file complexity, or SMTP.

### Spot-check findings (source inspected directly, not just inventory)

- `src/app/api/hod/me/route.ts` — `authenticateRequest` (bearer/Supabase
  auth) + `getHodTeacherRow` (Supabase query). Matches inventory.
- `src/app/api/user-usage/route.ts` — `authenticateRequest` +
  `getOrCreateUserUsage(auth.supabase, ...)`. Matches inventory
  ("Critical" risk).
- `src/app/api/account/export/route.ts` — auth + two Supabase table reads
  (`user_usage`, `lesson_plans`) + file-download response. Three excluded
  categories at once.
- `src/app/api/cron/subscription-maintenance/route.ts` — no *user* auth
  (gated only by the `x-vercel-cron-schedule` header), but uses
  `getSupabaseServiceRole()` and `reconcileAllSubscriptions` (mutates
  subscription state, sends renewal/expiry emails via SMTP). Confirms
  `SECURITY_AND_MIGRATION_RISKS.md`'s existing flag: "no repo-visible
  secret gate" — a real security note, but orthogonal to this
  checkpoint's migration-safety question. Not a Wave-1 candidate either
  way: service-role Supabase + SMTP + billing-adjacent writes.
- `src/app/api/welcome-email/route.ts` — Supabase SSR session + SMTP
  send.
- `src/app/api/auth/school-enrollment/route.ts` — `authenticateRequest` +
  Supabase school/user table writes.

**No inventory inaccuracies found.** Every spot-checked route's actual
source matched what `API_INVENTORY.md` and `BACKEND_MIGRATION_MANIFEST.md`
already said.

## Why "Potentially Authenticated Reads" Don't Qualify

This checkpoint's own eligibility rule allows authenticated READ
operations into Wave 1 "only if the existing proven auth infrastructure
is clearly sufficient and no unresolved RLS/session semantics are
involved." Neither condition holds for any remaining route:

1. **No auth-forwarding infrastructure exists.** The routing seam proven
   in Checkpoints 14–21 (`src/lib/backend-routing.ts` and both migrated
   routes' proxy-header builders) *deliberately never forwards*
   `Authorization` or `Cookie` — by design, because both pilots are
   public. `BACKEND_ROUTING_AND_ROLLBACK.md`'s own "Future Authenticated
   Routing" section already flags this as unbuilt, separate work:
   "Authenticated endpoints require a separate design. They may need
   Authorization forwarding, cookie preservation, body forwarding,
   explicit idempotency keys, no automatic fallback after uncertain
   writes, and live RLS/auth verification." There is no "existing proven
   auth infrastructure" to reuse — extending routing to forward
   `Authorization` would be new, unproven work with its own security
   review, not leverage from the pilot.
2. **RLS/session semantics are unresolved project-wide, not
   endpoint-specifically.** The database source-of-truth is
   `HYBRID_TRANSITION_REQUIRED` (`DATABASE_SOURCE_OF_TRUTH.md`, confirmed
   unchanged this checkpoint) — this is what blocks
   `lesson-plan/save` specifically, but the underlying problem (no
   reproducible local Supabase environment, incomplete migration history
   for baseline objects) is not scoped to that one table. Treating a
   *different* Supabase-backed read (e.g. `user_usage`, `hod` role data)
   as safe while the same underlying database-verification problem
   blocks `lesson_plans` would be inconsistent and would reintroduce,
   silently, exactly the risk this migration has repeatedly refused to
   take on outside a proven, isolated environment.

## Stop/Continue Decision

**SAFE COHORT EXISTS? No.**

This is not a case of "one endpoint turned out unsafe, exclude and
continue" — the entire remaining API surface was checked, and zero
additional operations meet the bar independently proven by the two
completed pilots. Manufacturing a "Wave 1" from auth-dependent or
Supabase-dependent routes would mean quietly lowering the safety bar this
migration has held since Checkpoint 14, not genuine migration leverage.

## Wave Map (Unchanged Scope, Refined From Investigation)

`MIGRATION_MASTER_PLAN.md`'s original Phase 5 ("Low-risk Endpoint
Migration") optimistically listed "account export read path, simple
usage reads" alongside geo/contact/waitlist/feedback as candidates. This
investigation (plus Checkpoint 18's earlier contact/waitlist/feedback
correction) shows that optimism was not borne out: **every** one of those
originally-listed candidates beyond geo turned out to have a real
Supabase, SMTP, or auth dependency once actual source was read. Updating
the map to reflect what investigation actually found, not what looked
plausible from route names:

| Wave | Scope | Blocker | Status |
| --- | --- | --- | --- |
| Wave 1 (pilot) | `GET /api/geo`, `POST /api/auth/verify-captcha` | none | **Complete** |
| Wave 2 | Authenticated Supabase-backed reads/writes (`user_usage`, `account/export`, `hod/me`, `lesson-plan/save`, `auth/school-enrollment`, `welcome-email`, `contact`/`feedback`/`waitlist`/`school-register`) | Database source-of-truth reconciliation (`HYBRID_TRANSITION_REQUIRED` → resolved) + a proven Authorization-forwarding routing design | Blocked |
| Wave 3 | AI/generation (`lesson-plan`, `question-paper`, `question-paper/blueprint`, `differentiated-pack`, `differentiated-pack/infer-meta`, extract-upload routes) | AI-service boundary design, streaming parity, quota coupling | Not started |
| Wave 4 | Billing/quota/webhooks (`razorpay/**`) | Money-impacting; needs replay/idempotency proof beyond this migration's current infrastructure | Not started |
| Wave 5 | Admin/school/security-sensitive (`school-admin/**`, `super-admin/**`, `school-template*`, `account/delete`) | Tenant isolation + privilege verification; likely depends on Wave 2's auth-forwarding design | Not started |
| Wave 6 | Export/PPT/specialized processing (`*/export/*`, `*/export-*`) | File-format parity, runtime package differences | Not started |
| Wave 7 | `cron/subscription-maintenance` | Currently has no visible secret gate (a pre-existing security note, not introduced by this migration) plus service-role writes + SMTP; needs its own security pass regardless of migration | Not started |

Wave 2 is the practical unlock for the largest number of subsequent
routes: `user_usage`, `account/export`, `hod/me`,
`auth/school-enrollment`, `welcome-email`, `contact`, `feedback`,
`waitlist`, `school-register`, and `lesson-plan/save` all wait on the
same two prerequisites (database reconciliation + auth-forwarding
routing design), not nine separate blockers.
