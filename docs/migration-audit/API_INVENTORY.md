# API Inventory

## Summary

- Next API route files: 80.
- Next HTTP operations: 84 (`GET` 24, `POST` 53, `PATCH` 1, `DELETE` 6).
- Standalone Python PPT API: `GET /health`, `POST /generate-ppt`.
- Primary implementation location: `src/app/api/**/route.ts`.

## Endpoint Groups

| Endpoint/group | Methods | Purpose | Handler evidence | Auth/authorization | Data/external services | Migration risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/lesson-plan` | POST | Generate lesson package, optional NDJSON progress | `src/app/api/lesson-plan/route.ts` | bearer auth, plan entitlement, quota, rate/spend limits | DeepSeek, fal.ai, Pexels, Supabase RPC/events | Critical |
| `/api/lesson-plan/extract-upload` | POST | Extract text from PDFs/images | `src/app/api/lesson-plan/extract-upload/route.ts` | bearer auth, rate limit | `pdf-parse`, `tesseract.js` | High |
| `/api/lesson-plan/export/docx` | POST | Export lesson content as DOCX | `src/app/api/lesson-plan/export/docx/route.ts` | bearer auth | `docx`, AFL helpers | Medium |
| `/api/lesson-plan/export/pptx` | POST | Export lesson deck as PPTX | `src/app/api/lesson-plan/export/pptx/route.ts` | bearer auth, rate limit | `pptxgenjs`, image resolver, template engine | High |
| `/api/lesson-plan/export/zip` | POST | Export lesson package ZIP | `src/app/api/lesson-plan/export/zip/route.ts` | bearer auth | `jszip`, export helpers | Medium |
| `/api/question-paper` | POST | Generate paper/answers/mark scheme | `src/app/api/question-paper/route.ts` | bearer auth, Pro entitlement, quota, rate/spend limits | DeepSeek, Supabase events/content | High |
| `/api/question-paper/blueprint` | POST | Generate blueprint from paper | `src/app/api/question-paper/blueprint/route.ts` | bearer auth, Pro entitlement | DeepSeek | High |
| `/api/question-paper/export/*` | POST | Export paper/blueprint/ZIP | route files under `src/app/api/question-paper/export` | bearer auth | `docx`, `jszip` | Medium |
| `/api/differentiated-pack` | POST | Generate one worksheet level | `src/app/api/differentiated-pack/route.ts` | bearer auth, Pro entitlement, rate/spend limits | DeepSeek, Supabase events/content | High |
| `/api/differentiated-pack/infer-meta` | POST | Infer topic/subject/grade/objectives from source | `src/app/api/differentiated-pack/infer-meta/route.ts` | bearer auth, Pro entitlement | DeepSeek | Medium-high |
| `/api/differentiated-pack/extract` | POST | Extract text from PDF/DOCX | `src/app/api/differentiated-pack/extract/route.ts` | bearer auth, rate limit | `mammoth`, PDF parser | Medium |
| `/api/differentiated-pack/export-*` | POST | Export worksheets DOCX/ZIP | route files under `src/app/api/differentiated-pack` | bearer auth | `docx`, `jszip` | Medium |
| `/api/user-usage` | GET | Fetch/create usage snapshot | `src/app/api/user-usage/route.ts` | bearer auth | Supabase RPCs | Critical |
| `/api/account/export` | GET | Export account data | `src/app/api/account/export/route.ts` | bearer auth, rate limit | Supabase `lesson_plans`, `user_usage` | High |
| `/api/account/delete` | DELETE | Delete authenticated account | `src/app/api/account/delete/route.ts` | bearer auth, rate limit | Supabase admin auth delete | Critical |
| `/api/auth/verify-captcha` | POST | Turnstile verification | `src/app/api/auth/verify-captcha/route.ts` | public, rate-limited | Cloudflare Turnstile | Medium |
| `/api/auth/school-enrollment` | POST | Sync user into school account | `src/app/api/auth/school-enrollment/route.ts` | bearer auth, rate limit | Supabase school/user tables | High |
| `/api/welcome-email` | POST | Send first welcome email | `src/app/api/welcome-email/route.ts` | Supabase SSR auth | SMTP, `user_usage` flag | Medium |
| `/api/contact`, `/api/feedback`, `/api/waitlist`, `/api/school-register` | POST | Public/lead/support submissions | corresponding route files | public/rate-limited, service role | Supabase, SMTP | Medium |
| `/api/geo` | GET | Pricing/location region lookup | `src/app/api/geo/route.ts` | public | Vercel geo header, ipapi.co, api.country.is | Low-medium |
| `/api/school-admin`, `/api/school-admin/me`, `/api/school-admin/teachers/[userId]` | GET/PATCH/DELETE | School admin dashboard and teacher management | route files under `src/app/api/school-admin` | bearer auth, school admin checks | Supabase admin | High |
| `/api/hod/me` | GET | HOD identity/department | `src/app/api/hod/me/route.ts` | bearer auth | Supabase | Medium |
| `/api/school-template`, `/api/school-template/upload` | GET/DELETE/POST | Manage school PPT template | route files under `src/app/api/school-template` | Supabase auth via header | `school_templates`, PPT parser | High |
| `/api/razorpay/create-order`, `/verify-payment` | POST | One-time payment order/verification | route files under `src/app/api/razorpay` | bearer auth | Razorpay, `razorpay_orders`, `user_usage` | Critical |
| `/api/razorpay/create-subscription`, `/verify-subscription`, `/subscription`, `/cancel-subscription` | POST/GET | Subscription lifecycle | route files under `src/app/api/razorpay` | bearer auth | Razorpay, `subscriptions`, `pending_trial_grants`, `user_usage` | Critical |
| `/api/razorpay/webhook` | POST | Reconcile payment/refund/subscription webhooks | `src/app/api/razorpay/webhook/route.ts` | HMAC signature | Razorpay payloads, Supabase | Critical |
| `/api/razorpay/admin/**` | GET/POST | Admin billing operations | route files under `src/app/api/razorpay/admin` | admin permissions | Razorpay, Supabase, audit logs, SMTP | Critical |
| `/api/super-admin/**` | GET/POST/DELETE | Platform admin users/schools/admins/content/analytics | route files under `src/app/api/super-admin` | admin role and granular permissions | Supabase admin, SMTP, audit logs | Critical |
| `/api/cron/subscription-maintenance` | GET | Daily subscription notices/expiry maintenance | `src/app/api/cron/subscription-maintenance/route.ts` | no repo-visible secret gate found in summary pass | Supabase, SMTP | High |

## Exact Next API Route List

| Route | Methods | Source |
| --- | --- | --- |
| `/api/account/delete` | DELETE | `src\app\api\account\delete\route.ts` |
| `/api/account/export` | GET | `src\app\api\account\export\route.ts` |
| `/api/auth/school-enrollment` | POST | `src\app\api\auth\school-enrollment\route.ts` |
| `/api/auth/verify-captcha` | POST | `src\app\api\auth\verify-captcha\route.ts` |
| `/api/contact` | POST | `src\app\api\contact\route.ts` |
| `/api/cron/subscription-maintenance` | GET | `src\app\api\cron\subscription-maintenance\route.ts` |
| `/api/differentiated-pack/export-docx` | POST | `src\app\api\differentiated-pack\export-docx\route.ts` |
| `/api/differentiated-pack/export-zip` | POST | `src\app\api\differentiated-pack\export-zip\route.ts` |
| `/api/differentiated-pack/extract` | POST | `src\app\api\differentiated-pack\extract\route.ts` |
| `/api/differentiated-pack/infer-meta` | POST | `src\app\api\differentiated-pack\infer-meta\route.ts` |
| `/api/differentiated-pack` | POST | `src\app\api\differentiated-pack\route.ts` |
| `/api/feedback` | POST | `src\app\api\feedback\route.ts` |
| `/api/geo` | GET | `src\app\api\geo\route.ts` |
| `/api/hod/me` | GET | `src\app\api\hod\me\route.ts` |
| `/api/lesson-plan/export/docx` | POST | `src\app\api\lesson-plan\export\docx\route.ts` |
| `/api/lesson-plan/export/pptx` | POST | `src\app\api\lesson-plan\export\pptx\route.ts` |
| `/api/lesson-plan/export/zip` | POST | `src\app\api\lesson-plan\export\zip\route.ts` |
| `/api/lesson-plan/extract-upload` | POST | `src\app\api\lesson-plan\extract-upload\route.ts` |
| `/api/lesson-plan` | POST | `src\app\api\lesson-plan\route.ts` |
| `/api/question-paper/blueprint` | POST | `src\app\api\question-paper\blueprint\route.ts` |
| `/api/question-paper/export/blueprint` | POST | `src\app\api\question-paper\export\blueprint\route.ts` |
| `/api/question-paper/export/docx` | POST | `src\app\api\question-paper\export\docx\route.ts` |
| `/api/question-paper/export/zip` | POST | `src\app\api\question-paper\export\zip\route.ts` |
| `/api/question-paper` | POST | `src\app\api\question-paper\route.ts` |
| `/api/razorpay/admin/failed-payments` | GET | `src\app\api\razorpay\admin\failed-payments\route.ts` |
| `/api/razorpay/admin/refund` | POST | `src\app\api\razorpay\admin\refund\route.ts` |
| `/api/razorpay/admin/retry-notify` | POST | `src\app\api\razorpay\admin\retry-notify\route.ts` |
| `/api/razorpay/admin/subscription/:id/offer` | POST | `src\app\api\razorpay\admin\subscription\[id]\offer\route.ts` |
| `/api/razorpay/admin/subscription/:id/pause` | POST | `src\app\api\razorpay\admin\subscription\[id]\pause\route.ts` |
| `/api/razorpay/admin/subscription/:id/resume` | POST | `src\app\api\razorpay\admin\subscription\[id]\resume\route.ts` |
| `/api/razorpay/admin/trial/grant` | POST | `src\app\api\razorpay\admin\trial\grant\route.ts` |
| `/api/razorpay/admin/users/:id/payments` | GET | `src\app\api\razorpay\admin\users\[id]\payments\route.ts` |
| `/api/razorpay/admin/users/:id/subscription` | GET | `src\app\api\razorpay\admin\users\[id]\subscription\route.ts` |
| `/api/razorpay/cancel-subscription` | POST | `src\app\api\razorpay\cancel-subscription\route.ts` |
| `/api/razorpay/create-order` | POST | `src\app\api\razorpay\create-order\route.ts` |
| `/api/razorpay/create-subscription` | POST | `src\app\api\razorpay\create-subscription\route.ts` |
| `/api/razorpay/subscription` | GET | `src\app\api\razorpay\subscription\route.ts` |
| `/api/razorpay/verify-payment` | POST | `src\app\api\razorpay\verify-payment\route.ts` |
| `/api/razorpay/verify-subscription` | POST | `src\app\api\razorpay\verify-subscription\route.ts` |
| `/api/razorpay/webhook` | POST | `src\app\api\razorpay\webhook\route.ts` |
| `/api/school-admin/me` | GET | `src\app\api\school-admin\me\route.ts` |
| `/api/school-admin` | GET | `src\app\api\school-admin\route.ts` |
| `/api/school-admin/teachers/:userId` | DELETE, PATCH | `src\app\api\school-admin\teachers\[userId]\route.ts` |
| `/api/school-register` | POST | `src\app\api\school-register\route.ts` |
| `/api/school-template` | DELETE, GET | `src\app\api\school-template\route.ts` |
| `/api/school-template/upload` | POST | `src\app\api\school-template\upload\route.ts` |
| `/api/super-admin/admins/grant` | POST | `src\app\api\super-admin\admins\grant\route.ts` |
| `/api/super-admin/admins/revoke` | POST | `src\app\api\super-admin\admins\revoke\route.ts` |
| `/api/super-admin/admins` | GET | `src\app\api\super-admin\admins\route.ts` |
| `/api/super-admin/analytics/overview` | GET | `src\app\api\super-admin\analytics\overview\route.ts` |
| `/api/super-admin/announcements` | GET, POST | `src\app\api\super-admin\announcements\route.ts` |
| `/api/super-admin/approve` | POST | `src\app\api\super-admin\approve\route.ts` |
| `/api/super-admin/change-plan` | POST | `src\app\api\super-admin\change-plan\route.ts` |
| `/api/super-admin/content/:type/:id` | DELETE | `src\app\api\super-admin\content\[type]\[id]\route.ts` |
| `/api/super-admin/content/flag` | POST | `src\app\api\super-admin\content\flag\route.ts` |
| `/api/super-admin/content` | GET | `src\app\api\super-admin\content\route.ts` |
| `/api/super-admin/deactivate-school` | POST | `src\app\api\super-admin\deactivate-school\route.ts` |
| `/api/super-admin/me` | GET | `src\app\api\super-admin\me\route.ts` |
| `/api/super-admin/pending` | GET | `src\app\api\super-admin\pending\route.ts` |
| `/api/super-admin/reactivate-school` | POST | `src\app\api\super-admin\reactivate-school\route.ts` |
| `/api/super-admin/reject` | POST | `src\app\api\super-admin\reject\route.ts` |
| `/api/super-admin/schools/:id/admins/:userId` | DELETE | `src\app\api\super-admin\schools\[id]\admins\[userId]\route.ts` |
| `/api/super-admin/schools/:id/admins` | POST | `src\app\api\super-admin\schools\[id]\admins\route.ts` |
| `/api/super-admin/schools/:id` | GET | `src\app\api\super-admin\schools\[id]\route.ts` |
| `/api/super-admin/schools` | GET | `src\app\api\super-admin\schools\route.ts` |
| `/api/super-admin/stats` | GET | `src\app\api\super-admin\stats\route.ts` |
| `/api/super-admin/users/:id/impersonate` | POST | `src\app\api\super-admin\users\[id]\impersonate\route.ts` |
| `/api/super-admin/users/:id/resend-reset` | POST | `src\app\api\super-admin\users\[id]\resend-reset\route.ts` |
| `/api/super-admin/users/:id/resend-verification` | POST | `src\app\api\super-admin\users\[id]\resend-verification\route.ts` |
| `/api/super-admin/users/:id/reset-quota` | POST | `src\app\api\super-admin\users\[id]\reset-quota\route.ts` |
| `/api/super-admin/users/:id` | DELETE, GET | `src\app\api\super-admin\users\[id]\route.ts` |
| `/api/super-admin/users/:id/suspend` | POST | `src\app\api\super-admin\users\[id]\suspend\route.ts` |
| `/api/super-admin/users/:id/unsuspend` | POST | `src\app\api\super-admin\users\[id]\unsuspend\route.ts` |
| `/api/super-admin/users/bulk/change-plan` | POST | `src\app\api\super-admin\users\bulk\change-plan\route.ts` |
| `/api/super-admin/users/export` | GET | `src\app\api\super-admin\users\export\route.ts` |
| `/api/super-admin/users` | GET | `src\app\api\super-admin\users\route.ts` |
| `/api/super-admin/verify-pin` | POST | `src\app\api\super-admin\verify-pin\route.ts` |
| `/api/user-usage` | GET | `src\app\api\user-usage\route.ts` |
| `/api/waitlist` | POST | `src\app\api\waitlist\route.ts` |
| `/api/welcome-email` | POST | `src\app\api\welcome-email\route.ts` |

## External Endpoints Consumed

- `https://api.deepseek.com/chat/completions`: DeepSeek chat completions.
- fal.ai model endpoints via `@fal-ai/client` and CSP hosts `rest.fal.run`, `fal.run`, `queue.fal.run`.
- `https://api.pexels.com/v1/search`: Pexels image search.
- Razorpay REST/Checkout/CDN endpoints.
- Cloudflare Turnstile verification endpoint.
- `https://ipapi.co/*` and `https://api.country.is/*`.
- Supabase Auth/PostgREST/storage websocket host under `*.supabase.co`.
- PostHog hosts via `/ingest` rewrites.

## Schemas and Error Behavior

Most handlers validate request bodies manually in TypeScript, not through a central schema package. Error responses are `NextResponse.json({ error })` with status codes, plus specialized fields such as `code`, `usage`, `parseNotice`, `rawResponse`, and `upgradePitch`. Migration should introduce OpenAPI/Pydantic schemas from observed handler contracts before rewriting.
