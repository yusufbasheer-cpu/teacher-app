# Authentication and Authorization

## Provider and Session Model

- Auth provider: Supabase Auth.
- Browser/server clients: `@supabase/ssr` wrappers in `src/lib/supabase-ssr.ts`.
- Browser client singleton: `src/lib/supabase.ts`.
- Server admin client: `src/lib/supabase-admin.ts`, using `SUPABASE_SERVICE_ROLE_KEY`.
- Middleware/proxy: `src/proxy.ts` refreshes sessions, adds `x-layah-user-id` and `x-layah-user-email` headers through constants in `src/lib/auth-header-names.ts`.

## Login/Signup/OAuth

- `/login`, `/signup`, and `/auth` render client auth flows.
- OAuth callback handled at `src/app/auth/callback/route.ts`, exchanging `code` via `supabase.auth.exchangeCodeForSession`.
- `src/proxy.ts` redirects OAuth `?code=` from arbitrary pages to `/auth/callback`; school registration has a special `redirect_to=/school-register?step=2`.
- Authenticated users visiting auth pages are redirected to `/dashboard`.

## API Authentication

Two patterns exist:

- Bearer token auth via `authenticateRequest(req)` in `src/lib/user-usage-server.ts`. Used by generation, usage, account, school enrollment, exports, and other APIs.
- Cookie/SSR Supabase auth via `createServerSupabaseClient()` in route handlers and pages.

FastAPI pilot boundary:

- `POST /api/lesson-plan/save` validates the existing bearer token through Supabase Auth `/auth/v1/user`, derives the user ID from the validated response, and forwards the same token to PostgREST. It does not use the service-role client.
- Checkpoint 9 did not change this strategy. The operational tradeoff is that each authenticated FastAPI request depends on Supabase Auth availability and latency unless a later checkpoint adds a verified local JWT/session validation approach.

## Authorization Models

| Area | Model | Evidence |
| --- | --- | --- |
| User data | Supabase RLS `auth.uid() = user_id` for own rows | `supabase/schema.sql` |
| Generation entitlements | `PLANS` config plus `getCallerPlanType` from `user_usage` | `src/lib/plans.ts`, `src/lib/user-usage-server.ts` |
| Account suspension | `authenticateRequest` checks `user_usage.account_status` | `src/lib/user-usage-server.ts` |
| School membership | `school_teachers` rows and email-domain enrollment | `src/lib/school-enrollment-server.ts`, `src/lib/school-admin-server.ts` |
| School roles | `school_teachers.role` = `teacher`, `hod`, `admin`; optional `department` | `src/components/school/school-admin-dashboard.tsx` |
| Platform admin | `admin_roles.role` = `super_admin` or `admin` | `src/lib/super-admin.ts` |
| Granular admin permissions | `admin_permissions.permission` strings, super_admin implicit all | `src/lib/super-admin.ts` |
| Super-admin page second factor | PIN check against `SUPER_ADMIN_PIN` | `src/app/api/super-admin/verify-pin/route.ts` |

## CSRF

`src/proxy.ts` blocks mutating `/api/*` requests with foreign `Origin`, allowing configured origins and same-origin hosts. This is important for preview deployments because same-origin host matching supports generated Vercel URLs.

## Migration Risks

- Supabase Auth cookies and bearer-token flows coexist; Python must validate Supabase JWTs and preserve cookie/browser expectations.
- Direct Supabase browser table access means frontend is not yet pure API-client-based.
- Service-role operations rely on application checks; moving code must not widen access.
- Hardcoded founder email allowlist is part of `isSuperAdmin` defense-in-depth and must be treated as behavior.
