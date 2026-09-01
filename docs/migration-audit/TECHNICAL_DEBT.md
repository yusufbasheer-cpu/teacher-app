# Technical Debt

| Item | Confidence | Evidence | Risk |
| --- | --- | --- | --- |
| Mixed frontend/backend/AI modules under `src/lib` | confirmed | imports from both client components and API routes | High migration complexity. |
| Direct Supabase browser CRUD for saved lessons | confirmed | `LessonPlanGenerator`, saved lesson components | Split leaves frontend coupled to DB/RLS. |
| Deprecated helper aliases remain | confirmed | `@deprecated` in `src/lib/user-usage.ts`, `src/lib/supabase/server.ts`, `src/lib/fal-ppt-slide-images.ts`, `src/lib/afl-tools.ts` | Low-medium; do not delete without trace. |
| Large route handlers with many responsibilities | confirmed | `src/app/api/lesson-plan/route.ts` | High testability/migration risk. |
| Extensive production `console.log`/`warn`/`error` | confirmed | grep across generation, admin, school, email modules | Medium privacy/noise risk. |
| No central request/response schema definitions | confirmed by route review | handlers validate manually | High parity risk. |
| `school_templates` table schema not located in summarized migration pass | unknown | API references table | High until verified. |
| `ai-research` and `obsidian-vault` not runtime-classified | unknown/probably non-runtime | top-level dirs | Low, but inspect before repo split. |
| One-off Razorpay plan creation script mutates external resources | confirmed | `scripts/create-razorpay-pro-plan.cjs` | Operational risk if run casually. |
| Python PPT service permissive CORS/no auth | confirmed visible | `python-ppt-api/main.py` | High if publicly exposed. |
| No proven non-production Supabase RLS integration environment | confirmed | Checkpoint 9/10 inspection, `FASTAPI_RLS_INTEGRATION.md` | Blocks authenticated Python cutover candidacy. |
| FastAPI bearer validation depends on Supabase Auth availability per request | confirmed | `backend-python/app/auth/dependencies.py` | Adds latency/availability coupling until a later auth architecture decision. |
| Database schema source of truth is hybrid/drifted | confirmed | `DATABASE_SOURCE_OF_TRUTH.md`, `SUPABASE_SCHEMA_DRIFT.md` | Fresh local reset and backend-owned schema migration remain blocked. |

Nothing should be removed solely from this list.
