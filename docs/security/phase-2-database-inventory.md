# Phase 2 — Database and storage inventory

Status: **static inventory complete; live catalog NOT yet captured.** This inventory comes from the 48 files in
`supabase/migrations/`, `supabase/schema.sql` and every Supabase call in `src/`. The brief requires the deployed
catalog, and the code already shows drift from the migrations (see "Known drift"). So every row below stays
provisional until `scripts/security/phase-2-catalog-inventory.sql` has been run on the isolated project
`esqnyktumxscyvznftlc` and its output pasted into "Live catalog".

Legend:
- **RLS**: as the migrations set it.
- **Client policies**: policies that let `anon` or `authenticated` reach rows. "none" means service role only.
- **Service-role routes**: the server code that bypasses RLS.

## User-private data

| Table | Owner column | RLS | Client policies | Service-role access (entry points) | Exposure assessment |
|---|---|---|---|---|---|
| `saved_lessons` | `user_id` → auth.users (cascade) | on | own-row S/I/U/D (verified live in Phase 1, 8/8) | `hod-server.ts`: HOD reads, scoped to school + department (Phase 1) | Isolated |
| `lesson_plans` | `user_id` | on | own-row S/I/U/D, U has WITH CHECK | `account/export` (own id) | Isolated by policy; live check pending |
| `user_usage` | `user_id` | on | SELECT own only; I/U revoked (20260728123000, 20260806150000) | usage RPCs, super-admin plan/quota, school enrolment | Credits not client-writable; live grant check pending |
| `active_sessions` | `user_id` | on | own-row S/I/U/D | — | Isolated |
| `school_templates` | `user_id` | on | `FOR ALL` own row, USING + WITH CHECK | — (the route uses the caller's JWT) | Isolated |
| `question_paper_generations`, `differentiated_pack_generations` | `user_id` | on | none | `content-persistence.ts`, which inserts `auth.userId` only; super-admin moderation | Service only |
| `gamma_generations` | `user_id` | on | none | `gamma/store.ts`, every query `.eq("user_id", auth.userId)` | Service only |
| `generation_events`, `ai_usage_events` | `user_id` | on | none | logging helpers; super-admin analytics | Service only |
| `razorpay_orders`, `razorpay_refunds`, `subscriptions`, `subscription_billing_notices`, `pending_trial_grants` | `user_id` | on | none | Razorpay routes (`authenticateRequest` → own id), webhook (signature), cron (bearer), super-admin billing (`hasPermission`) | Service only |

## Organisation / school-shared data

| Table | Scope column | RLS | Client policies | Notes |
|---|---|---|---|---|
| `school_accounts` | `id`, `admin_email` | on | SELECT: member of the school, or `lower(admin_email) = lower(jwt email)` | Admin identity is the **verified** sign-in email (email confirmation is on) |
| `school_teachers` | `school_id` (code) / `school_account_id` (migrations) | on | SELECT own membership; admin SELECT/DELETE via exact email match; ~~admin UPDATE via `ILIKE`~~ removed in Phase 2 | All app writes go through the service role after `findSchoolForAdmin(verified email)` |
| `school_registration_requests` | `admin_user_id` | on | SELECT own | Registration identity comes from Auth (Phase 1) |

## Admin-only data

`admin_roles`, `admin_permissions`, `audit_logs`, `impersonation_sessions`, `announcements`: RLS on, no client
policies. They are reached only by `/api/super-admin/*` and `/api/razorpay/admin/*`. All 41 of those handlers call
`isAdminUser`, `isSuperAdmin` or `hasPermission`, which read `admin_roles` with the service role.

## Public intake

`feedback`, `waitlist`: RLS on, with `INSERT WITH CHECK (true)` and no SELECT policy. Anyone can write and no
client can read. Both app routes insert through the service role, so the anonymous insert policy is not needed
(P3, kept for compatibility).

## Functions / RPCs

| Function | Definer | Acts on | Intended callers | Note |
|---|---|---|---|---|
| `refund_user_generation(uuid, date)` | yes | **caller-supplied user id** | service_role | Default Supabase grants may also give anon/authenticated EXECUTE. Fixed by the Phase 2 migration |
| `consume_user_generation()`, `ensure_user_usage()`, `ensure_own_user_usage()`, `increment_user_generations()` | yes, `search_path = public` | `auth.uid()`, raises on NULL | authenticated | anon EXECUTE revoked (least privilege) |
| `plan_generations_limit(text)`, `usage_today_utc()`, `usage_next_month_start_utc()`, `usage_row_json(...)` | helpers | — | internal | Read-only helpers |
| `sync_school_active_teachers()` | yes | trigger | trigger only | Cannot be called as an RPC |

## Storage

| Bucket | Public | Limits | Object policies | Access path |
|---|---|---|---|---|
| `gamma-pptx-artifacts` | false | 50 MB, PPTX MIME only | none, so clients are denied | Server only. Path `<userId>/<generationId>.pptx`. Looked up by `user_id`; since Phase 2, `readGammaArtifact` also refuses any path outside the caller's folder. No signed URLs are issued (`createGammaArtifactUrl` has no callers). |

School templates and uploads are not stored as objects. Extracted data goes to Postgres
(`upload-security.ts`, `school_templates.file_data`).

## Known drift (why the live catalog is required)

- `saved_lessons` is not created by any migration. It was made in the dashboard.
- The code filters `school_teachers` by `school_id`, but the migrations create and use `school_account_id`. The
  school policies on disk may not match the deployed ones.
- Several migrations re-create the same `user_usage` / `active_sessions` policies. Only the final deployed state
  counts.

## Live catalog

_Pending: paste the output of `scripts/security/phase-2-catalog-inventory.sql` (staging only) here._
