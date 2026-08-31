# Routes and Screens

## Frontend Pages

| Path | Screen | Source | Auth | API/backend calls | Rendering/actions |
| --- | --- | --- | --- | --- | --- |
| `/` | Marketing home | `src/app/page.tsx` | No | none | server page, CTA navigation |
| `/about` | About | `src/app/about/page.tsx` | No | none | server/static |
| `/auth` | Auth redirect/helper | `src/app/auth/page.tsx` | No | navigation only | client redirect behavior via Next navigation |
| `/blog` | Blog index | `src/app/blog/page.tsx` | No | none | static posts |
| `/blog/[slug]` | Blog detail | `src/app/blog/[slug]/page.tsx` | No | none | dynamic route param `slug` |
| `/contact` | Contact form | `src/app/contact/page.tsx` | No | `POST /api/contact` | client form |
| `/dashboard` | Dashboard | `src/app/dashboard/page.tsx` | Yes | `POST /api/welcome-email`, Supabase client | client session, school sync |
| `/differentiated-worksheets` | Worksheet pack generator | `src/app/differentiated-worksheets/page.tsx` | Yes | `/api/differentiated-pack*` | server auth wrapper plus client tool |
| `/faq` | FAQ | `src/app/faq/page.tsx` | No | none | static/pricing references |
| `/hod-dashboard` | HOD dashboard | `src/app/hod-dashboard/page.tsx` | Yes, HOD | `/api/hod/me` plus server helper | server guard |
| `/landing` | Redirect/landing alias | `src/app/landing/page.tsx` | No | none | navigation redirect |
| `/lesson-plan` | Lesson generator | `src/app/lesson-plan/page.tsx` | Yes | `/api/lesson-plan`, `/extract-upload`, export APIs | server guard plus client generator |
| `/login` | Login | `src/app/login/page.tsx` | No; redirects if already authed by proxy | Supabase OAuth/captcha through auth component | client auth card |
| `/my-lesson-plans` | Saved lessons list | `src/app/my-lesson-plans/page.tsx` | Yes | Supabase client | server guard |
| `/my-lesson-plans/[id]` | Saved lesson detail | `src/app/my-lesson-plans/[id]/page.tsx` | Yes | Supabase client | dynamic param `id` |
| `/onboarding` | Profile onboarding | `src/app/onboarding/page.tsx` | likely Yes | Supabase/profile helpers | profile form |
| `/overview` | Workspace overview | `src/app/overview/page.tsx` | Yes | workspace client calls | server guard |
| `/pricing` | Pricing | `src/app/pricing/page.tsx` | No | `/api/geo`, Razorpay via modal | pricing region behavior |
| `/privacy` | Privacy | `src/app/privacy/page.tsx` | No | none | legal layout |
| `/question-paper` | Question paper generator | `src/app/question-paper/page.tsx` | Yes, Pro for main use | `/api/question-paper*`, `/api/lesson-plan/extract-upload` | server guard plus client generator |
| `/school-admin` | School admin dashboard | `src/app/school-admin/page.tsx` | Yes, school admin | `/api/school-admin*` | server guard, client admin actions |
| `/school-register` | School registration | `src/app/school-register/page.tsx` | No/OAuth step | `POST /api/school-register` | supports `?code=` OAuth redirect and `?step=2` |
| `/settings` | Account settings | `src/app/settings/page.tsx` | Yes | `/api/account/*`, `/api/razorpay/subscription`, `/api/user-usage` | client account/billing actions |
| `/signup` | Signup | `src/app/signup/page.tsx` | No; redirects if authed by proxy | Supabase OAuth/captcha | client auth card |
| `/super-admin` | Platform admin | `src/app/super-admin/page.tsx` | Yes, admin role + PIN gate | `/api/super-admin/**`, `/api/razorpay/admin/**` | server role guard plus client console |
| `/terms` | Terms | `src/app/terms/page.tsx` | No | none | legal layout |

## Redirects/Rewrites/Middleware

- `src/proxy.ts` redirects authenticated users away from `/auth`, `/login`, and `/signup` to `/dashboard`.
- `src/proxy.ts` forwards OAuth `?code=` on non-callback paths to `/auth/callback`; `/school-register?code=` redirects to `/auth/callback?redirect_to=/school-register?step=2`.
- `next.config.ts` rewrites `/ingest/static/:path*` to PostHog assets and `/ingest/:path*` to PostHog ingestion.
- `src/proxy.ts` has a CSRF guard for mutating `/api/*` requests based on allowed origins or same-origin host check.
- Metadata routes: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/icon.tsx`, `src/app/apple-icon.tsx`.
