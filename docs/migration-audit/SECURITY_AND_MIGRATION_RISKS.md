# Security and Migration Risks

## Findings

| Severity | Risk | Evidence | Migration action |
| --- | --- | --- | --- |
| CRITICAL | Service-role Supabase operations rely on app-level auth checks. A migration bug can bypass RLS globally. | `src/lib/supabase-admin.ts`, admin/billing/school routes | Centralize authorization middleware and test denied cases. |
| CRITICAL | Razorpay webhook/billing state transitions are money-affecting. | `src/app/api/razorpay/webhook/route.ts`, admin billing routes | Webhook replay tests, idempotency checks, test-mode canaries. |
| CRITICAL | Usage quota reservation/refund must remain atomic and failure-safe. | `src/lib/user-usage-server.ts`, SQL RPC migrations | Preserve RPC semantics; add concurrency tests. |
| HIGH | Cron endpoint auth/secret gating was not evident in summarized route pass. | `vercel.json`, `/api/cron/subscription-maintenance` | Add/verify cron secret before exposing from new backend. |
| HIGH | Python PPT API has `CORS("*")` and no auth visible. | `python-ppt-api/main.py` | Add auth/internal-network protection or keep isolated. |
| HIGH | Direct client Supabase writes to `lesson_plans` make backend split incomplete. | `LessonPlanGenerator` saves via `supabase.from("lesson_plans")` | Move saved-lesson CRUD behind backend API or document RLS contract. |
| HIGH | In-memory rate/spend limiting is per-process and not durable. | `src/lib/rate-limit.ts`, generation routes | Use Redis/shared limiter in Python backend if scaling. |
| MEDIUM | Verbose logs may contain user content or provider response snippets. | `deepseek-log-raw.ts`, upload/generation logs | Scrub PII/content, reduce production logging. |
| MEDIUM | `SCHOOL_ADMIN_BYPASS_AUTH=1` lets any logged-in user load a placeholder school-admin page; intended local debugging only. | `src/app/school-admin/page.tsx` | Verify it is unset in deployed environments; do not carry to production backend. |
| MEDIUM | CSP allows `'unsafe-inline'` and `'unsafe-eval'` for Next/checkout needs. | `next.config.ts` | Reassess after split; keep required third-party origins minimal. |
| MEDIUM | AI prompts include teacher-uploaded/pasted content sent to providers. | generation routes | Update privacy/provider data-processing docs. |
| LOW | Public env vars expose expected browser keys. | `.env.example`, env audit | Accept by design; monitor accidental non-public secrets. |

No exploit attempts were made.
