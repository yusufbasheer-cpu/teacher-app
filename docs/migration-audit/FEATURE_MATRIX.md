# Feature Matrix

| Feature | Purpose | Frontend entry | Backend/API | Data/external services | Auth/plan | Notes and migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| Marketing home | Public landing content and CTA | `src/app/page.tsx`, `src/components/landing/*`, `src/components/home/*` | none | static assets in `public` | public | Low risk; frontend-only. |
| Static pages | About, FAQ, pricing, privacy, terms, contact | `src/app/about/page.tsx`, `faq`, `pricing`, `privacy`, `terms`, `contact` | `POST /api/contact` | SMTP via `sendEmail`; pricing constants | public/contact rate-limited | Contact form depends on backend mail. |
| Blog | Hardcoded blog listing/detail | `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` | none | `src/content/blog/posts.ts` | public | Low risk. |
| Login/signup/OAuth | User auth via Supabase | `src/app/login/page.tsx`, `signup`, `auth`, `auth/callback` | `GET /auth/callback`, `POST /api/welcome-email`, `POST /api/auth/verify-captcha` | Supabase Auth, Cloudflare Turnstile, SMTP | public then authenticated | High migration risk: cookies and middleware coupling. |
| Active session guard | One active login per account | `src/lib/active-session.ts`, auth components | Supabase direct table writes | `active_sessions` | authenticated | Frontend uses Supabase client directly. |
| Dashboard/workspace | Authenticated landing and navigation | `src/app/dashboard/page.tsx`, `src/components/dashboard/*` | `POST /api/welcome-email`; Supabase direct reads | Supabase | authenticated | Depends on browser Supabase session. |
| Profile onboarding | Collect profile metadata | `src/app/onboarding/page.tsx`, `profile-onboarding-form` | likely Supabase client updates | Supabase auth metadata/user table | authenticated | Verify profile field ownership before split. |
| Lesson generator | Generate teacher package | `src/app/lesson-plan/page.tsx`, `LessonPlanGenerator` | `POST /api/lesson-plan`, `POST /api/lesson-plan/extract-upload` | DeepSeek, fal.ai, Pexels, Supabase `user_usage`, `generation_events`; client saves `lesson_plans` | authenticated; free/pro entitlements | Critical. Route mixes AI orchestration, auth, quota, images, streaming, persistence. |
| Saved lessons | List/view/reuse saved lesson plans | `src/app/my-lesson-plans/page.tsx`, `[id]`, components | mostly Supabase browser table access; exports APIs | `lesson_plans` | authenticated/RLS | High: client writes/reads table directly. |
| Lesson exports | DOCX/PPTX/ZIP export | `TeacherPackageViewer` | `/api/lesson-plan/export/docx`, `/pptx`, `/zip` | `docx`, `pptxgenjs`, `jszip`, template helpers | authenticated | PPT template logic is complex and coupled to generated content format. |
| Question paper generator | Generate exam paper, optional answer key/mark scheme | `src/app/question-paper/page.tsx`, `QuestionPaperGenerator` | `POST /api/question-paper`, `/question-paper/blueprint` | DeepSeek, Supabase usage/events/content persistence | authenticated; Pro | High: AI + quota + persistence. |
| Question paper exports | Download paper/blueprint/ZIP | question paper component | `/api/question-paper/export/docx`, `/blueprint`, `/zip` | `docx`, `jszip` | authenticated | Medium. Preserve response MIME/names. |
| Differentiated worksheet packs | Generate foundation/core/extension packs | `src/app/differentiated-worksheets/page.tsx` | `/api/differentiated-pack`, `/extract`, `/infer-meta`, exports | DeepSeek, mammoth/pdf extraction, Supabase generation persistence | authenticated; Pro | High: three sequential frontend calls, one per level. |
| Upload/extract source content | Extract PDF/image/docx text | lesson/question/diff components | `/api/lesson-plan/extract-upload`, `/api/differentiated-pack/extract` | `pdf-parse`, `tesseract.js`, `mammoth` | authenticated, rate-limited | High for large files and runtime compatibility. |
| Usage/entitlements | Track monthly generations and plan limits | `useUserUsage`, usage components | `/api/user-usage`, generation APIs call RPCs | `user_usage`, Supabase RPCs | authenticated | Critical. Must preserve atomic reservation/refund behavior. |
| Billing checkout | Razorpay order/subscription checkout | `PaymentModal`, pricing/settings/admin components | `/api/razorpay/*` | Razorpay SDK/API, `razorpay_orders`, `subscriptions`, `pending_trial_grants` | authenticated | Critical. Payment side effects and webhook reconciliation. |
| Account export/delete | Export user data, delete account | `src/app/settings/page.tsx` | `/api/account/export`, `/api/account/delete` | Supabase user/data delete | authenticated/rate-limited | Critical privacy behavior. |
| School registration | Request school account | `src/app/school-register/page.tsx` | `POST /api/school-register` | Supabase, SMTP | public/rate-limited | Medium; admin approval completes lifecycle. |
| School enrollment | Sync teacher to school by email domain | auth callback/client helper | `POST /api/auth/school-enrollment` | `school_accounts`, `school_teachers`, user usage/profile | authenticated | High: login-time business logic. |
| School admin dashboard | Manage teachers, roles, departments | `src/app/school-admin/page.tsx`, `SchoolAdminDashboard` | `/api/school-admin`, `/teachers/[userId]` | Supabase service role | school admin | High: role/tenant checks need API-compatible migration. |
| HOD dashboard | Department dashboard | `src/app/hod-dashboard/page.tsx` | `/api/hod/me` | `school_teachers` | HOD role | Medium; exact feature breadth in `hod-server.ts`. |
| Super admin console | Platform administration | `src/app/super-admin/page.tsx`, admin components | `/api/super-admin/**`, `/api/razorpay/admin/**` | Supabase admin, Razorpay, SMTP | admin role + PIN for page | Critical: broad privileged surface. |
| Content moderation | Review/flag/delete generated content | super admin content tab | `/api/super-admin/content*` | `saved_lessons`, `question_paper_generations`, `differentiated_pack_generations` | admin permission | Medium-high; content persistence inconsistent by feature. |
| Announcements | Admin broadcast messages | admin announcements panel | `/api/super-admin/announcements` | `announcements`, SMTP | admin permission | Medium; async-ish email send in request. |
| Analytics | Admin operational metrics | admin analytics panel | `/api/super-admin/analytics/overview`, `/stats` | `generation_events`, billing tables, users | admin | Medium; metrics definitions should be snapshotted. |

## Hidden/Non-obvious Functionality

- CSRF guard for mutating `/api/*` requests in `src/proxy.ts`.
- PostHog reverse proxy rewrites at `/ingest/*` in `next.config.ts`.
- Welcome email idempotency via `user_usage.welcome_email_sent`.
- Usage-gate fail-open escape hatch via `USAGE_GATE_FAIL_OPEN`.
- Super-admin PIN second factor in `src/app/api/super-admin/verify-pin/route.ts`.
- Razorpay subscription maintenance cron in `vercel.json` and `src/app/api/cron/subscription-maintenance/route.ts`.
- School template upload stores parsed theme/logo/file data in `school_templates`.
