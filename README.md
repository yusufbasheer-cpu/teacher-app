# Teacher AI Studio

A clean Next.js + Tailwind CSS starter for a teacher-focused AI web app.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- ESLint
- PptxGenJS (PowerPoint export)
- docx (Word export)
- JSZip (ZIP packaging)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

4. Add your DeepSeek key:

   - Copy `.env.example` to `.env.local`
   - Set `DEEPSEEK_API_KEY`
   - Set `NEXT_PUBLIC_SUPABASE_URL`
   - Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL editor to create `lesson_plans` and
enable RLS policies so each teacher only sees their own saved records.

Auth uses Supabase email/password:

- `/auth` for signup/login
- `/lesson-plan` requires login before generating/saving
- `/my-lesson-plans` shows only the logged-in teacher's saved plans

## Initial Structure

- `src/app` - routes, root layout, and global styles
- `src/components/home` - homepage sections
- `src/components/lesson-plan` - lesson plan generator UI
- `src/components/lesson-plan/my-lesson-plans-list.tsx` - saved plans list
- `src/components/layout` - shared layout pieces (navbar)
- `src/components/auth` - signup/login UI
- `src/components/ui` - reusable UI primitives
- `src/lib` - app-level constants/helpers
- `src/types` - shared TypeScript types
- `src/app/api/lesson-plan` - DeepSeek lesson plan API route
- `src/app/api/lesson-plan/export/pptx` - PPT content → multi-slide PowerPoint
- `src/app/api/lesson-plan/export/docx` - section → Word (.docx)
- `src/app/api/lesson-plan/export/zip` - full teacher package ZIP
- `src/app/my-lesson-plans` - page to browse and reopen saved plans
- `supabase/schema.sql` - table and RLS policies for saved lesson plans
