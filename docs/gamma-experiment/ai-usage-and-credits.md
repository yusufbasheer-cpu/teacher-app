# AI usage & credits

The super-admin overview includes a staging-only “AI usage & credits” panel with today / 7d / 30d / all-time periods, provider totals, operation breakdown, top user IDs, and a compact daily trend.

## Gamma

`public.gamma_generations` remains the source of truth. The API aggregates runs, failures, completed-but-undelivered runs, reported credits, latest workspace balance, and configured daily/monthly budgets. Any row without `credits_deducted` is counted as **unsettled** and never silently treated as zero.

## DeepSeek

Migration `20261022171633_ai_usage_events.sql` creates an append-only service-role-only table. RLS is enabled, there are no policies, and every `anon`/`authenticated` grant is revoked. Direct DeepSeek call sites append best-effort events after reading the response body; logging never throws or delays the user response. Prompts, model selection, parsing, and educational rules are unchanged.

Recorded fields: user, provider, operation, returned model, prompt/completion/cache-hit/cache-miss/total tokens, estimated USD cost when verifiable, status, duration, timestamp.

Pricing was checked against the official DeepSeek pricing page on 2026-10-22. Defaults use conservative peak `deepseek-flash` rates: cache-hit input $0.006/M, cache-miss input $0.30/M, output $1.20/M. Every currency value is labelled an estimate. The application still requests `deepseek-chat`; official docs say that name was retired on 2026-07-24. Because model changes are outside this task, those events show tokens with **unpriced** cost rather than applying a different model’s price.

Staging application record:

- Target: `layah-staging` / `esqnyktumxscyvznftlc` (verified linked and `ACTIVE_HEALTHY`).
- Migration applied and recorded as `20261022171633 ai_usage_events`.
- RLS read-back: enabled. Client grant read-back: none.
- DB-backed integration test: service-role insert/read succeeds; anonymous read is denied.

Official sources: DeepSeek Models & Pricing (`https://api-docs.deepseek.com/quick_start/pricing/`) and change log (`https://api-docs.deepseek.com/updates/`).
