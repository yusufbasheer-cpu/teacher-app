# Current Architecture

## Repository Shape

Top-level directories:

| Path | Purpose | Evidence |
| --- | --- | --- |
| `.github/workflows` | CI workflow for typecheck, lint, test, build | `.github/workflows/ci.yml` |
| `.next` | generated local Next build/dev output | generated, not source |
| `.vercel` | Vercel metadata | `.vercel/` |
| `ai-research` | research/auxiliary material; not traced to runtime imports in this pass | directory listing |
| `docs` | existing docs plus this migration audit | `docs/architecture.md`, `docs/ui-flow.md` |
| `node_modules` | installed packages | generated |
| `obsidian-vault` | non-runtime notes/vault | directory listing |
| `public` | static web assets, logos, favicons, Google verification file | `public/Logo.png`, `public/google4767da2906b43ae2.html` |
| `python-ppt-api` | standalone Flask PPT API | `python-ppt-api/main.py` |
| `scripts` | one-off operational scripts | `scripts/create-razorpay-pro-plan.cjs`, `scripts/generate-favicons.cjs` |
| `src` | Next app, components, providers, hooks, lib modules | `src/app`, `src/components`, `src/lib` |
| `supabase` | schema and migrations | `supabase/schema.sql`, `supabase/migrations` |
| `tests` | additional Vitest tests | `tests/sql-plan-parity.test.ts` |

## Technology Stack

| Component | Language/runtime | Framework/library | Package manager/build | Purpose |
| --- | --- | --- | --- | --- |
| Web app | TypeScript on Node 22+ | Next.js 16 App Router, React 19 | npm, `next build` | UI, route handlers, SSR auth, APIs |
| Styling/UI | CSS/TSX | Tailwind CSS 4, shadcn-style primitives, lucide-react, framer/motion | PostCSS | product UI |
| Backend-in-Next | TypeScript | Next route handlers | Vercel serverless/node runtime | APIs, auth gates, AI, billing, exports |
| Database/auth | SQL + Supabase JS | Supabase Auth/Postgres/RLS | raw SQL migrations | auth, data, usage, billing, school/admin state |
| AI text | TypeScript HTTP fetch | DeepSeek chat completions | server route handlers | lesson, question paper, worksheet generation |
| AI/images | TypeScript | fal.ai client, Pexels HTTP API | server helpers | generated and stock images for lesson/PPT |
| PPT microservice | Python | Flask, python-pptx, flask-cors | pip/requirements | upload template and generate PPTX |
| Observability | TS | Sentry Next.js, PostHog | Next config/provider | error monitoring and analytics |
| Billing | TS | Razorpay SDK + webhooks | Next APIs | one-time orders, subscriptions, refunds, notices |

Sources: `package.json`, `.github/workflows/ci.yml`, `README.md`, `python-ppt-api/main.py`.

## Major Runtime Components

- Frontend screens live in `src/app/**/page.tsx`, with feature UI under `src/components`.
- Next backend endpoints live in `src/app/api/**/route.ts`.
- Shared/server utility modules live in `src/lib`; several files are mixed-boundary and must be split carefully.
- Supabase database state is in `supabase/schema.sql` and dated migrations.
- Python PPT service exposes `GET /health` and `POST /generate-ppt`.

## Build, Test, Run

- `npm run dev`: `next dev -p 3001`.
- `npm run build`: Next production build.
- `npm run start`: Next start.
- `npm run lint`: ESLint.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run test`: Vitest.

Source: `package.json`.
