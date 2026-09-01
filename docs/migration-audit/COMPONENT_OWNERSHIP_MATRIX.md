# Component Ownership Matrix

| Module/path | Classification | Reason | Migration note |
| --- | --- | --- | --- |
| `src/app/**/page.tsx` | FRONTEND | screens and server/client route wrappers | Keep Next frontend initially. |
| `src/components/ui`, `src/components/layout`, marketing/home/legal components | FRONTEND | presentational UI | Move to frontend repo. |
| `src/components/lesson-plan`, `question-paper`, `differentiated-pack` | FRONTEND with API contract dependencies | client workflow orchestration and Supabase browser calls | Extract API client layer before repo split. |
| `src/components/lesson-plan/lesson-plan-generator.tsx`, `lesson-view.tsx`, `my-lesson-plans-list.tsx` | FRONTEND with direct Supabase mutations | lesson persistence is still browser-owned | First candidate set for mutation boundary review. |
| `src/components/admin`, `src/components/school`, `src/components/hod` | FRONTEND with privileged API dependencies | admin UI calls Next APIs | Must preserve admin endpoint contracts. |
| `src/app/api/**/route.ts` | BACKEND / AI-SERVICE mixed | API handlers include business logic, AI, billing, admin operations | Split by endpoint ownership during Python migration; lesson-plan now delegates DeepSeek transport to `src/lib/deepseek-lesson-provider.ts`. |
| `src/lib/supabase*.ts`, `src/lib/auth-*`, `src/proxy.ts` | SHARED/BACKEND/FRONTEND mixed | Supabase clients, auth headers, middleware | Requires explicit auth boundary. |
| `src/lib/lesson-plan-save.ts`, `src/lib/geo-service.ts` | BACKEND service seams | server-only application logic with caller-context Supabase or external integration | Keep route concerns outside the service; suitable proof points for FastAPI migration. |
| `src/lib/user-usage*`, `src/lib/plans.ts`, `src/lib/pricing-regions.ts` | BACKEND with frontend mirror needs | plan/quota semantics are security-sensitive but UI displays them | Backend owns truth; frontend consumes contract. |
| `src/lib/active-session.ts`, `src/lib/user-usage-client.ts` | AUTH/QUOTA boundary helpers | browser-side Supabase mutations and RPCs | Keep out of the first business-data migration diff. |
| `src/lib/ai-facade.ts` | AI FACADE / backend service seam | dependency-inversion layer over DeepSeek, fal, and Pexels helpers | Current proof point for the future AI service boundary. |
| `src/lib/deepseek-lesson-provider.ts` | AI SERVICE / lesson provider seam | lesson-specific DeepSeek transport and normalization | Keeps the lesson route free of provider HTTP details while preserving orchestration. |
| `src/lib/deepseek-*`, `question-paper-prompt`, `differentiated-pack-prompts`, parsers | AI SERVICE | prompt/provider/output parsing | Move after API schemas and usage hooks stabilized. |
| `src/lib/fal-*`, `src/lib/pexels-images.ts`, `src/lib/ppt-image-resolver.ts` | AI SERVICE / media | image provider orchestration | Candidate AI service module, now accessed through `src/lib/ai-facade.ts` in some callers. |
| `src/lib/lesson-plan-export.ts`, `question-paper-export.ts`, `ppt-*`, `pptx-template.ts` | BACKEND or dedicated document service | export generation uses server packages | Keep backend initially; consider document service later. |
| `src/lib/razorpay.ts`, `src/app/api/razorpay/**` | BACKEND | billing and webhooks | Python backend should own. |
| `src/lib/school-*`, `src/app/api/school-*`, `hod-server.ts` | BACKEND | tenant/admin business logic | Python backend should own. |
| `src/lib/super-admin.ts`, admin APIs | BACKEND | privileged authorization/business ops | Python backend should own with tests. |
| `supabase/**` | SHARED DATA/INFRASTRUCTURE | schema and migrations | Own from backend repo, but frontend/AI need contracts. |

Checkpoint 8 adds the isolated Python ownership proof for `POST /api/lesson-plan/save`; the existing Next route and frontend remain authoritative until live Auth/RLS integration verification and a separately approved cutover.
| `python-ppt-api/**` | BACKEND/document service | Flask PPT generator | Could merge into Python backend or keep separate service. |
| `next.config.ts`, `vercel.json`, Sentry configs | INFRASTRUCTURE/FRONTEND deployment | Next/Vercel-specific | Frontend repo owns after split; backend gets separate infra. |
| `scripts/create-razorpay-pro-plan.cjs` | BACKEND/OPERATIONS | mutates Razorpay resources | Do not run without authorization; move to backend ops. |

Uncertain:

- `ai-research` and `obsidian-vault`: not traced to runtime imports in this pass.
- `school_templates` migration ownership: schema SQL exists as implementation comments in `src/lib/pptx-template.ts`, but not as a normal committed migration.
