# Dependency Graph

## Current Graph

```mermaid
flowchart TD
  Browser[Browser / Next UI] --> SupabaseClient[Supabase browser client]
  Browser --> NextAPI[Next API route handlers]
  Browser --> PostHog[/PostHog via /ingest rewrites/]
  Browser --> RazorpayCheckout[Razorpay Checkout JS]
  SupabaseClient --> Supabase[(Supabase Auth + Postgres)]
  NextAPI --> Supabase
  NextAPI --> DeepSeek[DeepSeek chat completions]
  NextAPI --> Fal[fal.ai FLUX]
  NextAPI --> Pexels[Pexels API]
  NextAPI --> Razorpay[Razorpay REST/webhooks]
  NextAPI --> SMTP[SMTP]
  NextAPI --> Turnstile[Cloudflare Turnstile]
  NextAPI --> Sentry[Sentry]
  VercelCron[Vercel Cron] --> NextAPI
  PythonPPT[Flask PPT API] --> PPTX[python-pptx]
```

## Target Graph

```mermaid
flowchart TD
  Frontend[repo-frontend Next.js] --> Backend[repo-backend-python FastAPI]
  Frontend --> PostHog
  Frontend --> RazorpayCheckout
  Backend --> Supabase[(Supabase/Postgres/Auth)]
  Backend --> Razorpay
  Backend --> SMTP
  Backend --> Turnstile
  Backend --> AI[repo-ai-services]
  AI --> DeepSeek
  AI --> Fal
  AI --> Pexels
  Scheduler[Scheduler/Cron] --> Backend
```

## Cross-component Dependencies

- Frontend directly depends on Supabase client and tables for auth/session/saved lessons.
- Frontend depends on exact Next API JSON/NDJSON shapes.
- Next APIs depend on `src/lib` modules that mix frontend-safe constants and server-only secrets.
- AI generation depends on backend quota and billing plan state.
- Billing depends on user usage updates and admin audit logging.
- Admin dashboards depend on Supabase Auth user list through service role.

Circular/coupled areas:

- `lesson-plan` generation returns content that the client writes directly to Supabase, while admin moderation reads the same table through backend APIs.
- Plan constants are used by UI and backend security checks.
- AI generation and usage metering are in the same request transaction without a durable job boundary.
