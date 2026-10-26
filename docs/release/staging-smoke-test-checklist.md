# Staging smoke-test checklist — https://staging.layah.in

Use a **dedicated staging test account** created on the staging Supabase project only. Never use a real teacher's account or production credentials.
Legend: ☐ pending · 💲 needs paid-provider approval first (Gamma / DeepSeek / fal.ai) · 🔒 security check

## 0. Pre-flight (operator)
- ☐ `GET /api/environment-check` → `isolated: true`, `ok: true`, `supabaseRef: esqnyktumxscyvznftlc`, `liveRazorpayKeyPresent: false`, `siteUrl: https://staging.layah.in`.
- ☐ Deployed build is the intended commit (compare Vercel deployment SHA with the release tip).
- ☐ Phase 2 DB step done **in this order**: run `scripts/security/phase-2-catalog-inventory.sql` → review → get approval → apply `20261025120000_phase2_…sql` → run the two transaction-test scripts.

## 1. Accounts and shell
- ☐ Sign up (email confirmation arrives; unconfirmed login shows the generic invalid-credentials message).
- ☐ Sign in; land on dashboard; no console errors.
- ☐ Dashboard loads; saved-lessons list shows contents strip + recency bands (This week / Earlier this month / Older).
- ☐ Command palette: Ctrl+K opens, search finds a saved lesson, Esc closes.
- ☐ Mobile (real phone, ≤ 400 px): drawer opens; Tab/focus stays inside; Esc/close restores focus; **swipe left closes** (short swipe snaps back, vertical scroll still works).
- ☐ Safe-area: header and cookie banner clear the notch / home indicator.
- ☐ Light ↔ dark toggle; both readable.

## 2. Lessons (no paid call unless noted)
- ☐ Open an existing saved lesson; edit and save.
- 💲 Create a new lesson plan (DeepSeek) and save it.
- ☐ Select a PPT design (theme gallery).
- 💲 Generate **one** Gamma PPT (record credit count before/after).
  - ☐ Layah Studio shows real stages only (no invented percentages).
  - ☐ Content is correct; activity-instruction slides are student-facing; required illustrations present; speaker notes present and non-repetitive.
- ☐ Download the PPT; opens in PowerPoint without a repair prompt.
- ☐ Reload the page and download again → **no new generation credit consumed**, no new Gamma submission.
- ☐ Worksheet pack and AFL activities load/download (💲 if they generate).

## 3. Accounts, schools, isolation 🔒
- ☐ Teacher login/logout; school registration flow completes; school admin/HOD pages gated by role.
- ☐ Single-session enforcement works on staging (sign in on a second browser → first is revoked). *(This is why `1b4d83c` was not taken.)*
- ☐ Two staging users A and B: B cannot open A's saved lesson URL, A's Gamma artifact URL, or A's resources (expect 403/404, not content).
- ☐ Palette shows only the signed-in user's lessons; after **account switch** no A content is visible.
- ☐ Log out → page and palette show no cached content; Back button does not reveal it.
- ☐ `POST /api/cron/subscription-maintenance` without `Authorization: Bearer` → 401 (fail-closed); not callable with only a `x-vercel-cron-schedule` header.

## 4. Telemetry (staging must not pollute production)
- ☐ DevTools Network on staging: no requests to PostHog / `/ingest` / Sentry ingest / GA.
- ☐ Trigger a harmless client error → nothing appears in the production Sentry project.

## 5. Sign-off
- ☐ All of §1–§4 passed (💲 items only after approval) → mark staging verified in the release report, with date, tester and deployment ID.
