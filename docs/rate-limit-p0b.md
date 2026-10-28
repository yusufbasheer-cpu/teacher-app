# P0-B rate-limit coverage and failure policy

The Redis key prefix is `layah:<namespace>:rate-limit`. The namespace resolves to
`production` for Vercel production, `staging` for Vercel previews, and `development`
otherwise; `RATE_LIMIT_NAMESPACE` is an explicit isolated-test override. Upstash SDK
timeouts are disabled (`timeout: 0`), because its default 5-second timeout resolves as
an allowed request. The wrapper adds its own 5-second fail-closed timeout so a Redis
request that never resolves cannot hang a route indefinitely.

| Route(s) | Method | Limit / identifier | Policy | Before costly work |
| --- | --- | --- | --- | --- |
| lesson-plan, differentiated-pack, infer-meta, question-paper, blueprint | POST | 10/hour IP; 30/day user; 50/hour spend user | closed | Yes, before DeepSeek/Gamma/provider work; user limits isolate accounts |
| differentiated exports (ZIP, DOCX), extract; lesson extract upload | POST | 20–30/hour IP | closed | Yes, before parsing/export work |
| account export/delete, school-template upload | GET/DELETE/POST | 3–10/hour IP | closed | Yes |
| school enrollment, captcha, super-admin PIN, school register | POST | 5/15 min or 10/hour IP | closed | Yes |
| contact | POST | 10/hour IP and 3/hour normalized email | bounded fallback | Yes, before mail delivery |
| welcome email, waitlist, feedback | POST | 3–10/hour IP | bounded fallback | Yes |
| usage-gate and spending alert throttles | internal | 1/hour alert key | bounded fallback | Before email send |

`bounded-fallback` is an in-process, maximum-500-key counter. It is intentionally
limited to low-risk public forms and alert throttling; it is never used for paid
generation. A closed-policy missing configuration, invalid credentials, outage, or
SDK timeout returns 503 with `Retry-After: 30`; an actual exhausted limit returns 429.

The IP identifier trusts `x-vercel-forwarded-for` first, then standard proxy headers.
Those headers are only trustworthy when Vercel is the network ingress; a direct origin
exposure or a misconfigured reverse proxy can allow spoofing. User-keyed paid limits
remain isolated and cannot be bypassed with an IP header.

Rate limits are distinct from plan entitlement, generation reservation/usage accounting,
and endpoint idempotency. They remain independent controls.

## Known coverage gap

Several authenticated document-export endpoints do not currently call the shared rate
limiter (`lesson-plan/export/docx`, `lesson-plan/export/zip`, question-paper document
exports, and the Gamma PPTX export route). They are not Redis-backed today and are not
represented as protected in this matrix. P0-B does not claim they are protected; they
need a follow-up route-specific limit before being described as high-cost fail-closed.
