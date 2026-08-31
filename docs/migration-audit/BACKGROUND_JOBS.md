# Background Jobs and Async Flows

| Flow | Trigger | Processing | Persistence/notification | Evidence | Risk |
| --- | --- | --- | --- | --- | --- |
| Subscription maintenance | Vercel cron daily `0 0 * * *` hitting `/api/cron/subscription-maintenance` | scans subscriptions, sends billing notices, halts/downgrades expired states | `subscription_billing_notices`, `subscriptions`, `user_usage`, SMTP | `vercel.json`, `src/app/api/cron/subscription-maintenance/route.ts`, `src/lib/subscription-billing.ts` | High; cron auth/host behavior unclear. |
| Razorpay webhook processing | Razorpay POST to `/api/razorpay/webhook` | verifies signature, handles refund/payment/subscription events | billing tables and `user_usage` | `src/app/api/razorpay/webhook/route.ts` | Critical; must replay real events in migration. |
| Lesson NDJSON streaming | client requests `streamProgress` | route creates `ReadableStream`, runs generation and image work | generation event, quota refund on stream failure | `src/app/api/lesson-plan/route.ts` | High; streaming contract must be preserved. |
| Best-effort generation logging | generation routes | async `void logGenerationEvent` | `generation_events` | `src/lib/generation-events.ts` | Medium; failures do not block user response. |
| Best-effort generated content persistence | question/differentiated routes | async insert after generation | moderation tables | `src/lib/content-persistence.ts` | Medium; not transactional with response. |
| Welcome email | auth callback/dashboard/API | checks/upserts usage flag then sends email | `user_usage.welcome_email_sent`, SMTP | `src/lib/welcome-email.ts`, `/api/welcome-email` | Medium; idempotency required. |
| Admin announcements | admin action | sends/stores announcement | `announcements`, SMTP | `/api/super-admin/announcements` | Medium; may be long-running in request. |
| Spending/usage alerts | usage/spending protection | send alert email when threshold/gate fails | SMTP, Sentry | `src/lib/user-usage-server.ts`, generation routes | Medium; in-memory throttling. |
| Python PPT request | external HTTP POST | synchronous PPTX generation in Flask | temporary files only, response download | `python-ppt-api/main.py` | Medium; no auth and open CORS visible. |

No dedicated queue worker, Redis queue, Celery, BullMQ, or durable background job processor was found.
