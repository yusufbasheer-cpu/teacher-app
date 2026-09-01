# Database Schema

Database: Supabase Postgres with Supabase Auth users. Schema management is currently split between `supabase/schema.sql`, `supabase/migrations`, and a small amount of legacy application-embedded SQL. See `DATABASE_SOURCE_OF_TRUTH.md` and `SUPABASE_SCHEMA_DRIFT.md`.

## Verification Labels

- `VERIFIED FROM SQL`: directly present in tracked SQL.
- `VERIFIED FROM APPLICATION USAGE`: required by TypeScript/Python code or tests.
- `INFERRED`: likely from code/docs, but not directly proven by executable SQL.
- `UNKNOWN`: requires live schema inspection or missing historical migration recovery.

## Tables and Models

| Table | Purpose | Key fields / relationships | Readers/writers | Evidence |
| --- | --- | --- | --- | --- |
| `lesson_plans` | Saved teacher packages | `id`, `user_id -> auth.users`, `curriculum_type`, `curriculum_framework`, `chapter`, `subject`, `grade`, `topic`, `learning_objectives`, `lesson_plan jsonb`, `created_at`; RLS own-user CRUD | client `LessonPlanGenerator`, saved lesson components, account export, moderation | `VERIFIED FROM SQL`: `supabase/schema.sql`; `VERIFIED FROM APPLICATION USAGE`: lesson-plan save services/tests |
| `active_sessions` | One active login/session per account | `user_id`, `session_token`, `device_info`, `created_at`; RLS own-user CRUD | `src/lib/active-session.ts` | migrations `20260519120000`, `20260526120000` |
| `user_usage` | Plan, quota, status, welcome-email flag | `user_id`, `plan_type`, `generations_used`, `generations_limit`, `reset_date`, `welcome_email_sent`, `account_status`, suspension fields | usage APIs, generation routes, auth/session, billing, admin | `supabase/schema.sql`, usage migrations, `src/lib/user-usage-server.ts` |
| `school_accounts` | Approved schools/tenants | name/domain/admin/plan/max/active/status/reason fields | enrollment, school admin, super admin | `20260524143000_school_accounts.sql`, later migrations |
| `school_teachers` | Teacher membership/role/department | `user_id`, `school_account_id`, `role`, `department`, joined date, per-school usage | enrollment, school/HOD admin | `20260524143000`, `20260613130000` |
| `school_registration_requests` | Pending school signup requests | applicant/school/contact/plan/status/reason | school-register, super-admin approve/reject | `20260528130000`, `20260825170000` |
| `admin_roles` | Platform admin roles | `user_id`, `role` (`super_admin`/`admin`) | super-admin gates | `20260531120000`, `20260825150000` |
| `admin_permissions` | Granular admin permissions | `user_id`, `permission`, `granted_at` | super-admin permission checks | `20260825150000`, `src/lib/super-admin.ts` |
| `audit_logs` | Admin action audit | admin/action/target/details/timestamp | admin actions | `20260531130000`, `src/lib/audit-log.ts` |
| `feedback` | User feedback submissions | message/contact metadata | `/api/feedback` | `20260610130000` |
| `waitlist` | Waitlist/lead capture | email, plan interest, created | `/api/waitlist` | `20260611120000`, `20260613120000` |
| `razorpay_orders` | One-time Razorpay orders | order/payment IDs, amount/currency/status/user | Razorpay order/verify/webhook/admin | `20260806140000` |
| `subscriptions` | Razorpay subscription state | `razorpay_subscription_id`, `user_id`, `plan_type`, status, current period, trial/pause/offer fields | subscription APIs, webhook, cron, admin | `20260807120000`, `20260825210000` |
| `razorpay_refunds` | Refund audit/reconciliation | refund/payment/order IDs, amount/status/user/admin | admin refund and webhook | `20260825200000` |
| `pending_trial_grants` | Admin-granted trial intent before subscription | user, days, expiry/consumption | create subscription, admin trial grant | `20260825210000` |
| `generation_events` | Append-only generation analytics | user, generation_type, status, plan, metered, error, duration | generation routes, analytics | `20260825160000`, `src/lib/generation-events.ts` |
| `question_paper_generations` | Moderatable generated question papers | user, subject/grade/topic/curriculum, content jsonb, flag/delete fields | question-paper route, content moderation | `20260825180000`, `src/lib/content-persistence.ts` |
| `differentiated_pack_generations` | Moderatable generated worksheet packs | same shape as question papers | differentiated-pack route, content moderation | `20260825180000`, `src/lib/content-persistence.ts` |
| `announcements` | Admin broadcast messages | title/body/audience/sent metadata | announcements panel/API | `20260825220000` |
| `subscription_billing_notices` | Idempotent billing notice tracking | subscription/user/notice kind/date | subscription maintenance | `20260830120000`, `src/lib/subscription-billing.ts` |
| `school_templates` | School PPT template storage and extracted design | `id`, `user_id -> auth.users`, original filename, thumbnail, colors, fonts, `logo_base64`, `file_data`, `UNIQUE(user_id)` | school-template APIs, PPT export | schema instructions embedded in `src/lib/pptx-template.ts`; route-side fallback ALTERs in `src/app/api/school-template/upload/route.ts` | Risk: not represented as a normal migration. |

## RPC Functions

- `ensure_user_usage()`: creates/resets usage row and returns normalized usage payload.
- `consume_user_generation()`: atomically reserves/increments generation usage under row lock.
- `refund_user_generation(p_user_id, p_reset_date)`: service-role-only refund of reserved generation.
- `plan_generations_limit(p_plan)`, `usage_today_utc()`, `usage_next_month_start_utc()`, `usage_row_json(...)`.
- `sync_school_active_teachers()`: keeps school active teacher counts.

Evidence: `supabase/migrations/20260728120000_usage_gate_functions.sql`, `src/lib/user-usage-server.ts`, `supabase/migrations/20260524143000_school_accounts.sql`.

## RLS and Constraints

RLS is enabled on user-owned tables such as `lesson_plans`, `active_sessions`, `user_usage`, `school_accounts`, `school_teachers`, feedback/waitlist/billing/admin tables. Many admin workflows intentionally bypass RLS through `SUPABASE_SERVICE_ROLE_KEY` after application-level checks.

Migration risk: Python backend must preserve both Supabase Auth compatibility and the exact security-definer RPC behavior for atomic usage gating.

## lesson_plans Contract Detail

`VERIFIED FROM SQL`:

- columns: `id`, `user_id`, `curriculum_type`, `subject`, `grade`, `chapter`, `curriculum_framework`, `topic`, `learning_objectives`, `lesson_plan`, `created_at`
- primary key: `id`
- foreign key: `user_id references auth.users(id) on delete cascade`
- defaults: `gen_random_uuid()` for `id`, `'Other'` for `curriculum_type`, `''` for `chapter`, `''` for `curriculum_framework`, `now()` for `created_at`
- RLS enabled on `public.lesson_plans`
- insert/select/update/delete owner policies using `auth.uid() = user_id`

`VERIFIED FROM APPLICATION USAGE`:

- `POST /api/lesson-plan/save` writes `curriculum_type`, `curriculum_framework`, `subject`, `grade`, `chapter`, `topic`, `learning_objectives`, and `lesson_plan`.
- Python parity pilot writes the same fields through PostgREST with caller bearer authorization.
- Contract fixtures cover insert/update request shape, not live database policy decisions.

`UNKNOWN`:

- whether deployed production/staging have extra `lesson_plans` indexes, grants, triggers, or columns not represented in tracked SQL
- whether `schema.sql` was manually authored or exported from an early Supabase project
- whether a missing historical base migration exists outside this repository

## FastAPI Lesson-Plan Pilot

- The pilot writes only `lesson_plans` through PostgREST.
- Insert uses the validated caller token and RLS `with check (auth.uid() = user_id)`.
- Update filters by both `id` and the authenticated `user_id`, while the table's `using` and `with check` policies remain active.
- No service-role key, direct Postgres connection, SQLAlchemy, or migration change is introduced.
- Checkpoint 9 inspected the policy SQL from `supabase/schema.sql`, but did not run it against a live Supabase database because no non-production target was safely identifiable.
- Checkpoint 12 added a static SQL invariant test for `lesson_plans` owner RLS, but live RLS verification is still blocked.
