# Layah

AI lesson-planning SaaS for schoolteachers (layah.in). From a subject, grade, topic and
curriculum, Layah generates a full teacher package: a structured lesson plan, a 13-slide
PowerPoint, worksheets, homework, a question paper with mark scheme, and differentiated
(Foundation/Core/Extension) worksheet packs — exportable as Word/PPT/ZIP.

See [docs/architecture.md](docs/architecture.md) for the full architecture writeup
(routes, API, data flow, auth) and [docs/ui-flow.md](docs/ui-flow.md) for a route-by-route
UI walkthrough.

## Stack

- Next.js (App Router, TypeScript), Tailwind CSS 4, shadcn/ui
- Supabase (Postgres + Auth), raw SQL migrations in `supabase/migrations/`
- DeepSeek for AI generation, fal.ai / Pexels for images
- Sentry (errors), PostHog (analytics)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the keys (Supabase, DeepSeek, SMTP,
   etc.). See `.env.example` for the full list.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Opens on [http://localhost:3001](http://localhost:3001) (note: port **3001**, not 3000).

4. Before pushing, run:

   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

## Deployment

The app deploys to Vercel on push to `main`. There is also a separate Python service
(`python-ppt-api/`) deployed independently — check `python-ppt-api/render.yaml` /
`railway.json` / `Procfile` to confirm which platform is currently live for it.

### Uploaded PowerPoint templates

Apply `supabase/migrations/20260919120000_school_templates.sql` before enabling uploads.
Deploy `python-ppt-api/` and set the same random `PPT_TEMPLATE_SERVICE_SECRET` in
the Python service and the Next.js app. Set `PPT_TEMPLATE_SERVICE_URL` in Next.js
to the Python service's origin (without a trailing path). The built-in Layah
templates work without this service; uploaded-template exports return a clear
unavailable message until it is configured.

Teachers can upload a completed editable `.pptx` in the lesson's PPT template
selector. The uploaded deck is reused as the visual source. The renderer
supports slides with identifiable title and body text areas, ordinary shapes,
and one large replaceable lesson picture per slide. A slide that is artwork only (no text areas) is also accepted: Layah adds a title and content area in the clear space beside the artwork and places lesson pictures next to the text. Slides with generated images
need a clear picture area in the uploaded design. It duplicates source slide
designs when the lesson needs more slides. Charts, grouped content, embedded
objects, and ambiguous old text return an incompatibility warning with a Layah
template fallback. Fit detection is conservative and is based on text geometry;
PowerPoint rendering can vary by installed fonts.

## Project structure

- `src/app` — routes, root layout, API routes (`src/app/api`)
- `src/components` — UI, organized by feature (`lesson-plan/`, `question-paper/`,
  `school/`, `admin/`, etc.) plus shared primitives in `components/ui/`
- `src/lib` — server/client helpers (Supabase clients, DeepSeek prompts, exports, pricing)
- `src/content/blog` — blog posts (hardcoded TypeScript, no CMS)
- `supabase/` — `schema.sql` and dated migrations, applied via the Supabase CLI/dashboard
