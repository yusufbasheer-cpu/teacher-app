# Gamma preview feature lock

The lock is active only when `GAMMA_ENVIRONMENT_NAME` is set to a non-production name, exactly like the application isolation guard. `EXPERIMENT_ALLOWED_FEATURES` is a comma-separated list of named capabilities; an empty value uses the safe in-code default. Outside an isolated environment the lock is a no-op.

Blocked pages redirect to `/lesson-plan?unavailable=experimental-preview`. Blocked APIs return `404 { code: "experiment_feature_locked" }`. `NEXT_PUBLIC_GAMMA_EXPERIMENT=true` is only a navigation-visibility hint; the proxy remains the server authority.

Decision: DOCX and ZIP exports remain enabled because they package already-generated DeepSeek output and do not call Gamma, fal.ai, or Pexels. The legacy renderer remains an explicit tester rollback. Gamma mode hides the legacy Layah theme picker and school-template upload.

## Route matrix

| Page | Preview | Feature |
|---|---:|---|
| `/`, `/dashboard`, `/overview` | Allowed | Minimal home/dashboard |
| `/auth`, `/auth/*`, `/login`, `/signup` | Allowed | Authentication |
| `/lesson-plan` | Allowed | DeepSeek lesson generation |
| `/my-lesson-plans`, `/my-lesson-plans/[id]` | Allowed | Reopen saved lessons |
| `/settings` | Allowed | Minimal account settings |
| `/super-admin` | Allowed | PIN-gated operator console |
| `/question-paper`, `/differentiated-worksheets` | Blocked | Other generators |
| `/school-admin`, `/school-register`, `/hod-dashboard` | Blocked | School administration |
| `/onboarding` | Blocked | Tester profile is already complete |
| `/landing`, `/about`, `/faq`, `/contact`, `/blog`, `/blog/[slug]`, `/privacy`, `/terms`, `/pricing` | Blocked | Marketing/legal/payment surfaces |

| API | Preview | Feature |
|---|---:|---|
| `/api/environment-check` | Allowed | Non-secret isolation diagnostics |
| `/api/auth/school-enrollment`, `/api/auth/verify-captcha` | Allowed | Auth helpers |
| `/api/lesson-plan`, `/api/lesson-plan/extract-upload` | Allowed | DeepSeek content |
| `/api/lesson-plan/export/docx`, `/pptx`, `/pptx/themes`, `/zip` | Allowed | Existing-content exports and Gamma metadata |
| `/api/user-usage` | Allowed | Entitlements/quota |
| `/api/account/delete`, `/api/account/export` | Allowed | Settings actions |
| `/api/super-admin/*` | Allowed | Operator console |
| `/api/question-paper/*`, `/api/differentiated-pack/*` | Blocked | Other generators |
| `/api/razorpay/*` | Blocked | Payments |
| `/api/school-admin/*`, `/api/school-register`, `/api/school-template/*`, `/api/hod/me` | Blocked | School/HOD surfaces |
| `/api/contact`, `/api/feedback`, `/api/waitlist`, `/api/welcome-email` | Blocked | Public messaging/forms |
| `/api/geo` | Blocked | Pricing helper |
| `/api/cron/subscription-maintenance` | Blocked | Billing maintenance |

Tests cover the pure policy, environment override, proxy behavior, isolation failures, and no effect outside isolation. `/api/environment-check` reports `{ featureLock: { active, allowed } }`.
