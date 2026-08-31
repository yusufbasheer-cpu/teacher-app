# AI Architecture

## Providers and Models

| Provider | Model/API | Use | Source |
| --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/chat/completions`, model `deepseek-chat` | text generation for lesson plans, PPT slide bodies, AFL sheets, question papers, blueprints, differentiated packs, metadata inference | `src/lib/deepseek-lesson-provider.ts`, `src/lib/question-paper-deepseek.ts`, differentiated routes |
| fal.ai | `fal-ai/flux-1/dev` | generated educational illustrations and PPT slide images | `src/lib/fal-flux-section-images.ts`, `src/lib/fal-ppt-slide-images.ts` |
| Pexels | `/v1/search` | stock landscape image URLs for selected PPT slides | `src/lib/pexels-images.ts` |

No OpenAI, Anthropic, Gemini, vector database, embeddings, RAG, speech-to-text, text-to-speech, or AI phone/calling provider was found in runtime code during this pass.

Current boundary proof point: `src/lib/ai-facade.ts` now sits between selected application callers and the existing DeepSeek/fal/Pexels helpers, while `src/lib/deepseek-lesson-provider.ts` isolates lesson-specific DeepSeek transport.

## Lesson AI Chain

User submits lesson form in `LessonPlanGenerator`
-> `POST /api/lesson-plan`
-> validate curriculum/grade/subject/source
-> `authenticateRequest`
-> `getCallerPlanType` and entitlement checks
-> rate/spend protection
-> `reserveGeneration`
-> build framework/AFL/strategy prompt blocks
-> lesson route delegates DeepSeek transport to `src/lib/deepseek-lesson-provider.ts`
-> DeepSeek calls per teacher-package section
-> for PPT, generate 13 isolated slide bodies in parallel
-> parse marker-delimited output
-> generate/attach Pexels/fal images
-> log generation event
-> return JSON or NDJSON progress
-> client renders package and saves `lesson_plans` via Supabase browser client.

Evidence: `src/components/lesson-plan/lesson-plan-generator.tsx`, `src/app/api/lesson-plan/route.ts`, `src/lib/deepseek-lesson-system-prompt.ts`, `src/lib/ppt-individual-slide-generator.ts`.

## Question Paper Chain

User submits paper wizard
-> `POST /api/question-paper`
-> auth/plan/quota/rate/spend checks
-> build system/user prompt
-> `callDeepSeekChat`
-> parse paper/answer/marking sections
-> log/refund on failure as needed
-> persist to `question_paper_generations`
-> return content.

Optional blueprint is a second frontend request to `/api/question-paper/blueprint`.

Evidence: `src/components/question-paper/question-paper-generator.tsx`, `src/app/api/question-paper/route.ts`, `src/lib/question-paper-prompt.ts`, `src/lib/ai-facade.ts`.

## Differentiated Pack Chain

User provides/loads lesson source
-> frontend sequentially calls `/api/differentiated-pack` for `foundation`, `core`, `extension`
-> each call authenticates/checks Pro/rate/spend
-> DeepSeek prompt for one level
-> parse six expected sections
-> log non-metered generation event
-> persist generated content for moderation
-> frontend merges levels and offers DOCX/ZIP export.

Evidence: `src/components/differentiated-pack/differentiated-worksheet-pack.tsx`, `src/app/api/differentiated-pack/route.ts`.

## AI Usage and Metering

- Lesson and question paper generation reserve/refund generation quota with Supabase RPCs.
- Differentiated pack currently logs `metered: false` and does not call `reserveGeneration`.
- Generation attempts are best-effort logged to `generation_events`.
- Spending protection is in-memory per Next process via `src/lib/rate-limit.ts`, so horizontal scaling semantics are approximate.

## AI Extraction Candidate Boundaries

Move to AI services:

- Prompt builders and parsers specific to DeepSeek workflows.
- DeepSeek/fal/Pexels provider clients.
- AI generation orchestration and output normalization.

Keep in backend:

- Auth, plan checks, usage reservation/refund source of truth.
- Persistence ownership and moderation tables.
- Billing and school/admin authorization.

Interface recommendation: backend calls AI service with an internal service token, passing a request ID, user ID, plan context, generation type, and content payload. AI service returns normalized content, provider metadata, warnings, and cost/usage metadata.
