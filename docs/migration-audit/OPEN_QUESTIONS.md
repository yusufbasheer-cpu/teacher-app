# Open Questions

| Question | Why it matters | Evidence found | Missing | How to verify | Migration impact |
| --- | --- | --- | --- | --- | --- |
| What are the actual production, staging, and current preview URLs? | Required for environment comparison | Request had placeholders | concrete URLs | user provides URLs; crawl/test | Blocks Phase 12. |
| Which deployment currently hosts `python-ppt-api`? | Determines infra split | Render/Railway/Procfile all present | active platform/domain | inspect deployment dashboard or env references | Affects backend/document service plan. |
| Has the embedded `school_templates` SQL actually been applied in production/staging? | API depends on table | schema instructions are comments in `src/lib/pptx-template.ts`; upload route has fallback ALTERs for two columns | database state in each environment | inspect Supabase schemas or run read-only catalog query | Could break PPT template feature if omitted during migration. |
| Are there production/staging env var differences? | Feature behavior may differ | `.env.example` only | deployed env values/variable presence, not secrets | Vercel/platform env audit | Required before cutover. |
| What credentials/test accounts can be used for role-specific flows? | Needed for route and permission verification | admin/school/HOD code present | safe test users | user provides seeded test accounts | Blocks E2E parity. |
| Is `SCHOOL_ADMIN_BYPASS_AUTH=1` set in any deployed environment? | It allows any logged-in user to load a placeholder school-admin dashboard page | `src/app/school-admin/page.tsx` marks it as local debugging bypass | deployed env state | inspect Vercel/platform env vars | Must be unset in production/staging before migration. |
| Are paid AI and phone/calling features authorized for live testing? | Avoid costs/destructive calls | no phone/calling code found; AI code present | explicit testing permission | user authorization | Blocks live AI parity. |
| Are `ai-research` and `obsidian-vault` source, docs, or private notes? | Repo split ownership | top-level dirs found | runtime relevance | inspect with owner approval/context | Low-medium organization risk. |
| What is the canonical domain/branch mapping? | Deployment migration | README says Vercel on `main` | staging/preview branch rules | Vercel/GitHub settings | Required for deployment architecture. |
| Should `lesson_plans` or another mutation move before `saved_lessons`? | Phase 1 / Phase 2 sequencing | current inventory suggests `lesson_plans` is lower risk | contract tests for the chosen mutation | review contract docs and call sites before code changes | Determines first Supabase migration diff size and risk. |
| Which browser-side third-party calls should remain outside the frontend API client? | Boundary clarity | Razorpay checkout, Turnstile, Sentry, PostHog, Product Hunt detected | explicit owner decision | confirm per integration | Prevents an over-broad client wrapper. |
