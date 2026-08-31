# Test Inventory

## Existing Automated Tests

| Test file | Area | Notes |
| --- | --- | --- |
| `src/lib/plans.test.ts` | plan definitions and entitlements | unit tests |
| `src/lib/user-usage.test.ts` | usage snapshot/limit logic | unit tests |
| `src/lib/user-usage-dates.test.ts` | reset date behavior | unit tests, TZ set to Asia/Dubai |
| `src/lib/pricing-regions.test.ts` | pricing region logic | unit tests |
| `tests/sql-plan-parity.test.ts` | SQL plan parity | compares SQL plan assumptions to app constants |

Config: `vitest.config.ts`, environment `node`, includes `src/**/*.test.ts` and `tests/**/*.test.ts`.

## Missing Coverage

- No E2E/browser tests found.
- No component tests found.
- No API contract tests found.
- No Razorpay webhook replay tests found.
- No Supabase RLS/security integration tests found.
- No AI provider mocked-contract tests found.
- No document export snapshot tests found.
- No file extraction fixture tests found.
- No cron tests found.
- No load/performance tests found.

Migration implication: current test coverage is not enough to prove repo split or Python backend parity.
