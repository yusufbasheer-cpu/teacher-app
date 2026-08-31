# Environment Comparison

## Status

The request contained placeholders instead of usable URLs:

- Production: `<PASTE_PRODUCTION_URL_HERE>` / `<PRODUCTION_URL>`
- Staging: `<PASTE_STAGING_URL_HERE>` / `<STAGING_URL>`
- Current branch: `<PASTE_CURRENT_BRANCH_URL_HERE>` / `<CURRENT_BRANCH_URL>`

No browser/network comparison was performed because there were no concrete deployed URLs and no credentials.

## Comparison Matrix

| Feature / Behavior | Production | Staging | Current branch | Difference | Expected? | Source-code explanation | Migration implication |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Routes/navigation | Not tested | Not tested | Source found 26 pages | Unknown | Unknown | `src/app/**/page.tsx` | Need live crawl after URLs are provided. |
| API behavior | Not tested | Not tested | Source found 84 Next ops | Unknown | Unknown | `src/app/api/**/route.ts` | Need non-destructive API smoke tests. |
| Auth flow | Not tested | Not tested | Supabase OAuth/cookies via proxy | Unknown | Unknown | `src/proxy.ts`, `auth/callback` | Need test accounts. |
| AI behavior | Not tested | Not tested | DeepSeek/fal/Pexels code present | Unknown | Unknown | generation routes and image helpers | Avoid paid AI calls unless authorized. |
| Billing | Not tested | Not tested | Razorpay code present | Unknown | Unknown | `src/app/api/razorpay/**` | Use test mode/webhook replay only. |
| Console/network errors | Not tested | Not tested | Not tested | Unknown | Unknown | N/A | Requires deployed URLs and browser tooling. |

## Verification Needed

Provide production, staging, and preview URLs plus test credentials. Then run:

- unauthenticated route crawl
- login/signup/logout flow
- authenticated route crawl
- non-paid generation dry run or explicit authorized paid calls
- Razorpay test-mode checkout/webhook replay
- responsive screenshots
- network/console error capture
