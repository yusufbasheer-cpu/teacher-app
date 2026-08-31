# Environment Variables

Actual values were not copied. Variable names were gathered from `.env.example` and `process.env.*` references.

| Variable | Purpose | Scope | Secret? | Future owner | Evidence |
| --- | --- | --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek chat completions | server | Yes | AI-SERVICES | generation routes, `.env.example` |
| `FAL_API_KEY` | fal.ai credentials | server | Yes | AI-SERVICES | fal helpers, `.env.example` |
| `FAL_KEY` | alternate fal.ai credential name | server | Yes | AI-SERVICES | `src/lib/fal-flux-section-images.ts` |
| `PEXELS_API_KEY` | Pexels API | server | Yes | AI-SERVICES | Pexels helpers, `.env.example` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | browser/server | No | SHARED/DEPLOYMENT | Supabase helpers |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | browser/server | Public credential | FRONTEND/SHARED | Supabase helpers |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin bypass RLS | server only | Yes | BACKEND | `src/lib/supabase-admin.ts` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key | browser | No | FRONTEND | auth widget, `.env.example` |
| `TURNSTILE_SECRET_KEY` | Turnstile verify secret | server | Yes | BACKEND | verify captcha route |
| `SUPER_ADMIN_PIN` | Admin second-factor PIN | server | Yes | BACKEND | super-admin verify PIN |
| `RAZORPAY_KEY_ID` | Razorpay server key ID | server | Sensitive | BACKEND | Razorpay helper/script |
| `RAZORPAY_KEY_SECRET` | Razorpay server secret | server | Yes | BACKEND | Razorpay helper/script |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay checkout key | browser/server response | No/public | FRONTEND/BACKEND | payment routes, `.env.example` |
| `RAZORPAY_PRO_PLAN_ID` | Razorpay Pro subscription plan | server | No/operational | BACKEND | create subscription route |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook HMAC secret | server | Yes | BACKEND | webhook verifier |
| `SMTP_HOST` | SMTP host | server | No | BACKEND | `send-email.ts` |
| `SMTP_USER` | SMTP username | server | Sensitive | BACKEND | `send-email.ts` |
| `SMTP_PASSWORD` | SMTP password | server | Yes | BACKEND | `send-email.ts` |
| `SMTP_FROM` | outbound sender | server | No | BACKEND | `send-email.ts` |
| `DEBUG` | verbose server logging | server | No | SHARED/DEPLOYMENT | `user-usage-server.ts`, `.env.example` |
| `USAGE_GATE_FAIL_OPEN` | break-glass usage-gate behavior | server | No but high-impact | BACKEND | `user-usage-server.ts` |
| `NEXT_PUBLIC_SITE_URL` | allowed origin addition | server/build/public | No | SHARED/DEPLOYMENT | `src/proxy.ts` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog public project key | browser | No/public | FRONTEND | PostHog provider |
| `SENTRY_DSN` | Sentry server DSN | server | Sensitive-ish | SHARED/DEPLOYMENT | Sentry configs |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry browser DSN | browser | No/public | FRONTEND | `.env.example`, Sentry provider |
| `SENTRY_ORG` | Sentry source-map upload org | build/CI | No | DEPLOYMENT | `next.config.ts` |
| `SENTRY_PROJECT` | Sentry source-map upload project | build/CI | No | DEPLOYMENT | `next.config.ts` |
| `SENTRY_AUTH_TOKEN` | Sentry source-map upload token | build/CI | Yes | DEPLOYMENT | `next.config.ts` |
| `SCHOOL_ADMIN_BYPASS_AUTH` | bypass flag for school admin auth | server | High-risk if enabled | BACKEND | env reference grep |
| `NODE_ENV` | runtime mode | build/server | No | DEPLOYMENT | `next.config.ts` |
| `NEXT_RUNTIME` | Next runtime discriminator | server | No | DEPLOYMENT | env reference grep |
| `PORT` | Flask port | Python server | No | BACKEND/PPT service | `python-ppt-api/main.py` |
| `FLASK_DEBUG` | Flask debug mode | Python server | No but risky | BACKEND/PPT service | `python-ppt-api/main.py` |

## Frontend Secret Exposure Check

Known frontend-exposed variables are prefixed `NEXT_PUBLIC_*`. No server-only secret with a non-public name was found intentionally referenced in client components during this pass. However, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, Supabase anon key, PostHog key, Turnstile site key, and Sentry browser DSN are public by design.

## Boundary Notes

- `src/lib/auth-headers.ts` is the browser-side auth header helper and must stay client-safe.
- `src/lib/try-parse-api-json.ts` is frontend-safe and should be reused for local API responses instead of ad hoc parsers.
- `SUPABASE_SERVICE_ROLE_KEY` and other server-only secrets must never enter the browser API-client abstraction.
