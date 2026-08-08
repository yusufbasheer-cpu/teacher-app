# Architecture Overview — Teacher AI Studio

> A beginner-friendly map of this codebase. Nothing here changes application behavior — it's documentation only.

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), latest version |
| Language | TypeScript / React |
| Package manager | npm (`package-lock.json` present) |
| Styling | Tailwind CSS |
| Database & Auth | Supabase (Postgres + Supabase Auth), accessed via `@supabase/ssr` and `@supabase/supabase-js` |
| AI text generation | DeepSeek (`deepseek-chat` model, called directly via `fetch`) |
| AI image generation | fal.ai (Flux model), with Pexels stock photos as a fallback |
| Document export | `pptxgenjs` (PowerPoint), `docx` (Word), `jszip` (bundling) |
| OCR / file parsing | `tesseract.js`, `pdf-parse`, `mammoth` |
| Observability | Sentry (errors + session replay), PostHog (product analytics) |
| Bot protection | Cloudflare Turnstile (signup captcha) |
| Dev server | `next dev -p 3001` (note: **port 3001**, not the default 3000) |

There's also a separate **`python-ppt-api/`** folder at the repo root — a small standalone Python service (see its own `Procfile`/`render.yaml`/`railway.json`), independent of the main Next.js app's deploy pipeline. Investigate it separately if you need to touch PPT generation on the Python side.

## 2. Folder Overview

```
teacher-app/
├── src/
│   ├── app/                  # Next.js App Router — pages & API routes (see §3, §4)
│   │   ├── api/              # Backend route handlers (~20 top-level feature folders)
│   │   ├── auth/              # Login/signup page + OAuth callback route
│   │   ├── dashboard/          # Post-login landing page
│   │   ├── lesson-plan/        # Lesson plan generator feature
│   │   ├── question-paper/     # Question paper generator feature
│   │   ├── differentiated-worksheets/  # Leveled worksheet pack generator
│   │   ├── my-lesson-plans/    # Saved lesson plans (list + [id] viewer)
│   │   ├── hod-dashboard/       # Head-of-Department dashboard (role-gated)
│   │   ├── school-admin/       # School admin dashboard (role-gated)
│   │   ├── super-admin/        # Platform admin dashboard (role + PIN gated)
│   │   ├── settings/, pricing/, blog/, about/, faq/, contact/, privacy/, terms/  # Static/marketing pages
│   │   ├── landing/            # Actual marketing homepage
│   │   ├── layout.tsx          # Root layout — all global providers (see §5)
│   │   └── page.tsx            # `/` — redirects to `/landing`
│   ├── components/            # UI components, grouped by feature (lesson-plan/, auth/, hod/, school/, admin/, ui/, effects/, layout/, ...)
│   ├── hooks/                 # Shared custom hooks (use-user-usage.ts, use-pricing-region.ts)
│   ├── lib/                   # Business logic, Supabase clients, AI prompt builders, exporters (~70 files, see §6)
│   ├── providers/              # posthog-provider.tsx (React context/init wrapper)
│   ├── content/blog/            # Static blog post content (used for SSG)
│   ├── types/                  # Shared TypeScript types
│   └── proxy.ts                # Next.js middleware equivalent (auth/CSRF/session logic — see §7)
├── supabase/
│   ├── schema.sql              # Full DB schema snapshot
│   └── migrations/              # Chronological SQL migrations (source of truth for DB history)
├── public/                     # Static assets (logo, favicons)
├── scripts/                    # One-off Node scripts (favicon generation)
├── python-ppt-api/              # Separate Python microservice (PPT-related, independently deployed)
├── sentry.*.config.ts           # Sentry SDK config for client/server/edge runtimes
├── instrumentation.ts           # Next.js instrumentation hook (loads Sentry server config)
├── next.config.ts               # Next.js config: CSP headers, Sentry build plugin, external packages
└── .env.example                 # Documented environment variables (incomplete — see §8)
```

## 3. Application Entry Points

- **`src/app/page.tsx`** (`/`) — does nothing but `redirect("/landing")`. The real homepage is `/landing`.
- **`src/app/layout.tsx`** — the root layout every single route passes through. There are **no other `layout.tsx` files** anywhere in `src/app` — every route relies on this one root layout plus its own `page.tsx`.
- **`src/proxy.ts`** — Next.js's middleware, just under an unconventional filename. Runs on (almost) every request before the page/route handler. See §7.

## 4. Routes / Pages

| Route | What it does |
|---|---|
| `/` | Redirects to `/landing`. |
| `/landing` | Marketing homepage (hero, stats, testimonials, feedback, footer). |
| `/about` | Static "About" page. |
| `/faq` | Static FAQ accordion. |
| `/contact` | Contact form → posts to `/api/contact`. |
| `/pricing` | Pricing page, region-aware via `usePricingRegion` (currently hardcoded — see §8 caveat). |
| `/privacy`, `/terms` | Static legal pages via a shared `LegalPageLayout`. |
| `/blog`, `/blog/[slug]` | Blog index + individual post (statically generated from `src/content/blog`). |
| `/auth` | Login/signup form (`AuthCard`), includes Turnstile captcha. |
| `/auth/callback` (route handler) | Exchanges an OAuth `?code=` for a Supabase session, applies school plan, sends welcome email, redirects to `/dashboard`. |
| `/dashboard` | Post-login landing page; handles OAuth redirect-through, registers the "active session," shows usage/plan info. |
| `/lesson-plan` | AI Lesson Plan Generator (flagship feature). |
| `/my-lesson-plans`, `/my-lesson-plans/[id]` | List of saved lesson plans, and a single plan viewer. |
| `/question-paper` | AI Question Paper Generator. |
| `/differentiated-worksheets` | Generates leveled (Foundation/Core/Extension) worksheet packs. |
| `/settings` | Account settings — usage/plan display, account delete/export. |
| `/school-register` | School registration form/wizard. |
| `/hod-dashboard` | Head-of-Department view (role-gated: redirects out if the user isn't a HOD). |
| `/school-admin` | School admin dashboard (role-gated; has a `SCHOOL_ADMIN_BYPASS_AUTH` **dev-only** bypass flag — don't rely on it in production reasoning). |
| `/super-admin` | Platform admin dashboard — gated by an email allowlist **and** a DB role **and** a runtime PIN (`SuperAdminPinGate`). |

**Dynamic routes**: `blog/[slug]`, `my-lesson-plans/[id]`, and (in the API) `api/school-admin/teachers/[userId]`.

## 5. API Routes (`src/app/api`)

~45 route handlers, grouped by feature. The three AI-generation features (lesson-plan, question-paper, differentiated-pack) each follow the same shape: a main generation route + sibling `export/*` routes for docx/pptx/zip output.

| Group | Routes | Purpose |
|---|---|---|
| `lesson-plan/` | `route.ts`, `extract-upload`, `export/docx`, `export/pptx`, `export/zip` | Generate a lesson plan (DeepSeek + fal.ai), optionally from an uploaded doc (OCR), then export it. |
| `ppt/` | `slide-1` … `slide-13` | One route per PowerPoint slide, so slides can be generated/regenerated individually rather than as one giant call. |
| `question-paper/` | `route.ts`, `blueprint`, `export/blueprint`, `export/docx`, `export/zip` | Generate a question paper (DeepSeek), with a "blueprint" (structure) step before full content. |
| `differentiated-pack/` | `route.ts`, `extract`, `infer-meta`, `export-docx`, `export-zip` | Generate leveled worksheet packs, with metadata inference and file extraction. |
| `user-usage/` | `route.ts` | Returns the caller's generation usage/plan snapshot. |
| `account/` | `delete`, `export` | Account deletion and GDPR-style data export. |
| `auth/` | `school-enrollment`, `verify-captcha` | School domain auto-enrollment; Turnstile captcha verification. |
| `hod/me` | — | Whether the caller is a Head of Department. |
| `school-admin/` | `route.ts`, `me`, `teachers/[userId]` | School admin dashboard data and per-teacher management. |
| `school-template/` | `route.ts`, `upload` | CRUD + upload for a school's document/branding template. |
| `school-register` | — | Registers a new school. |
| `super-admin/` | `me`, `pending`, `schools`, `stats`, `users`, `approve`, `reject`, `change-plan`, `deactivate-school`, `verify-pin` | Full platform-admin surface: approvals, plan changes, stats. |
| `contact`, `feedback`, `waitlist`, `send-welcome-email`, `welcome-email` | — | Form submissions and transactional emails. |
| `get-image`, `geo`, `test-image` | — | Pexels image search; IP geolocation (currently unused by pricing); dev test endpoint. |
| `debug/school-enrollment` | — | Diagnostic endpoint — reads Supabase config directly. |

## 6. Shared Layouts, Providers, Hooks, Components

**Root layout composition** (`src/app/layout.tsx`), outermost to innermost:

```
<SentryProvider>          — force-initializes Sentry in the browser
  <PostHogProvider>        — initializes PostHog + captures pageviews on route change
    <AppEffects />       — cosmetic effects (particles, cursor, magnetic buttons)
    <NavbarWrapper />     — top nav (hidden on landing)
    <ActiveSessionGuard>  — enforces single-active-device-session for protected routes
      <PageTransitionWrapper>
        {page content}
      </PageTransitionWrapper>
    </ActiveSessionGuard>
    <CookieBanner />
  </PostHogProvider>
</SentryProvider>
```

- **`src/providers/posthog-provider.tsx`** — PostHog init + `PostHogPageView` (calls `usePathname`/`useSearchParams` to fire a `$pageview` event on every route change).
- **`src/components/sentry-provider.tsx`** — belt-and-suspenders Sentry init alongside `sentry.client.config.ts`.
- **`src/hooks/use-user-usage.ts`** — fetches `/api/user-usage`, returns `{ usage, loading, headline, subline, refresh, applyUsage }`. Used by every generator page to show remaining-generation counts and upgrade prompts.
- **`src/hooks/use-pricing-region.ts`** — **currently stubbed**: always returns the `gcc`/AED region regardless of the visitor's actual location. A code comment says geo-detection is disabled until the payment gateway goes live — don't assume `/api/geo` is actually driving pricing today.
- **Reusable components** are organized by feature under `src/components/` (`lesson-plan/`, `question-paper/`, `differentiated-pack/`, `auth/`, `hod/`, `school/`, `admin/`, `payment/`, `pricing/`, `usage/`, `legal/`, `landing/`, `home/`, `layout/`, `ui/`, `effects/`, `cursor/`).

## 7. Data Flow Example: Lesson Plan Generation

This is the clearest example of the UI → hooks/lib → API → external service pipeline that the other AI features (question paper, differentiated pack) mirror.

```
src/app/lesson-plan/page.tsx
  └─ renders (client) src/components/lesson-plan/lesson-plan-generator.tsx
       ├─ getAuthHeaders()            (src/lib/auth-headers.ts)      — attaches Supabase bearer token
       ├─ useUserUsage()              (src/hooks/use-user-usage.ts)  — shows remaining generations
       ├─ optional: POST /api/lesson-plan/extract-upload             — OCR an uploaded file first
       └─ POST /api/lesson-plan       (src/app/api/lesson-plan/route.ts)
            ├─ authenticateRequest / assertCanGenerate / recordSuccessfulGeneration
            │     (src/lib/user-usage-server.ts — calls Supabase to verify JWT + check/increment quota)
            ├─ checkRateLimit / checkSpendingProtection   (src/lib/rate-limit.ts)
            ├─ buildDeepseekLessonSystemPrompt            (src/lib/deepseek-lesson-system-prompt.ts)
            ├─ fetch("https://api.deepseek.com/chat/completions")    — text generation
            ├─ generateFluxSectionImages                 (src/lib/fal-flux-section-images.ts — fal.ai)
            ├─ parseTeacherPackageResponse                (src/lib/parse-teacher-package-response.ts)
            └─ responds with NDJSON stream
       └─ rendered by src/components/lesson-plan/teacher-package-viewer.tsx
```

Once a plan exists, the client can separately call `export/docx`, `export/pptx`, or `export/zip` — these only format already-generated content; they don't call DeepSeek or fal.ai again.

## 8. Authentication

**Model**: Supabase Auth (Google OAuth + email/password) using `@supabase/ssr` for cookie-based sessions, plus a custom single-active-device-session layer and per-page role gating for admin surfaces.

| File | Role |
|---|---|
| `src/lib/supabase-ssr.ts` | Defines three client factories: `createClient()` (browser), `createServerSupabaseClient()` (server components/route handlers), `createMiddlewareSupabaseClient()` (used only in `proxy.ts`). |
| `src/lib/supabase.ts` | Singleton browser client, re-exported for convenience. |
| `src/lib/supabase-admin.ts` | Service-role client (bypasses Row-Level Security) — for privileged server operations only, after verifying the caller's JWT. |
| `src/lib/auth-headers.ts` | Client-side helper that reads the current session and builds an `Authorization: Bearer <token>` header for calling protected API routes. |
| `src/lib/user-usage-server.ts` | Server-side `authenticateRequest` — the shared bearer-token → Supabase-user resolver used by nearly every API route, paired with quota enforcement. |
| `src/lib/auth-post-login.ts` | Post-login orchestration: registers the active session, runs school-domain enrollment, ensures a usage row exists, fires the welcome email. |
| `src/lib/auth-callback-school.ts` | Looks up `school_accounts` by email domain and applies the matching plan. |
| `src/lib/google-oauth-callback.ts` | Client-side PKCE code-exchange + session polling for the Google OAuth flow. |
| `src/lib/protected-routes.ts` | Lists which app paths require the active-session check (`/lesson-plan`, `/my-lesson-plans`, `/differentiated-worksheets`, `/question-paper`). |
| `src/lib/csrf.ts` | Origin-header allowlist check used inside individual API route handlers. |
| `src/proxy.ts` | Next.js middleware: CSRF guard on `/api/*` mutations, session refresh for admin routes, OAuth `?code=` redirect-through, and bouncing logged-in users away from `/auth`. |
| `src/app/auth/callback/route.ts` | The actual PKCE code-exchange route handler. |
| `src/components/auth/active-session-guard.tsx` | Polls every 5 minutes (and on auth state change) whether this browser is still the "active" device session; force-logs-out otherwise. |
| `src/components/auth/auth-card.tsx`, `turnstile-widget.tsx` | Login/signup form UI and the Cloudflare Turnstile captcha embed. |

**Admin role gating** happens per-page (not centrally): `hod-dashboard/page.tsx`, `school-admin/page.tsx`, and `super-admin/page.tsx` are server components that each call `createServerSupabaseClient()` plus a lookup function, and `redirect()` if the check fails. `super-admin` additionally requires a runtime PIN (`SUPER_ADMIN_PIN` env var) as a second factor beyond Supabase auth.

### Environment variables

Documented in `.env.example`:

| Variable | Purpose |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek chat-completions API key. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key that bypasses RLS. |
| `PEXELS_API_KEY` | Stock photo fallback. |
| `FAL_API_KEY` | fal.ai key (image generation). |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Transactional email (Hostinger SMTP). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Signup captcha. |
| `SUPER_ADMIN_PIN` | Second factor for `/super-admin`. |
| `DEBUG` | Verbose server logging toggle. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSNs. |

**Not in `.env.example` but referenced in code** — a new developer will need these too:
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` — analytics init.
- `NEXT_PUBLIC_SITE_URL` — an extra allowed CSRF origin.
- `SCHOOL_ADMIN_BYPASS_AUTH` — local-dev-only auth bypass for `/school-admin`.
- `FAL_KEY` — alternate name accepted alongside `FAL_API_KEY`.
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — build-time only, for source-map uploads.

## 9. State Management

**No Redux, Zustand, or React Query** — none appear in `package.json`, and none are used anywhere in `src`. State is managed with plain React:

- **No global React Context for app state** — state is managed with plain React.
- **Local component state** (`useState`/`useEffect`/`useCallback`) inside each feature's client component — every generator page manages its own form/loading/error state independently.
- **Custom hooks as the shared-state layer**: `useUserUsage` and `usePricingRegion` wrap `fetch` + Supabase calls and are reused across pages.
- **Supabase session itself is the source of truth for auth state** — components call `supabase.auth.getSession()` / `onAuthStateChange` directly rather than going through a context provider.

## 10. Ten Most Important Files to Read First

1. **`src/app/layout.tsx`** — the composition root; shows every global provider in one place.
2. **`src/proxy.ts`** — the middleware: CSRF, OAuth redirects, session refresh, post-login routing.
3. **`src/lib/supabase-ssr.ts`** — the three Supabase client factories everything else depends on.
4. **`src/app/auth/callback/route.ts`** — the PKCE code-exchange + school-plan assignment flow.
5. **`src/lib/user-usage-server.ts`** — shared auth + quota-enforcement logic used by almost every API route.
6. **`src/app/api/lesson-plan/route.ts`** — the largest, most representative API route (auth → rate-limit → DeepSeek → fal.ai → parse → respond).
7. **`src/components/lesson-plan/lesson-plan-generator.tsx`** — the canonical feature-page client component pattern, mirrored by question-paper and differentiated-worksheets.
8. **`src/lib/protected-routes.ts`** + **`src/components/auth/active-session-guard.tsx`** — the single-device-session security model.
9. **`src/lib/lesson-plan.ts`** — central type definitions shared by the UI, API route, and export/PPT pipeline.
10. **`next.config.ts`** — reveals the CSP allowlist (which third-party services the app actually talks to), Sentry build wiring, and Node-runtime package requirements.

**Also worth a look**: `.env.example` (env var contract, though incomplete — see §8) and `supabase/schema.sql` (the full database shape).

---
*Generated as a documentation-only pass — no application code was modified.*
