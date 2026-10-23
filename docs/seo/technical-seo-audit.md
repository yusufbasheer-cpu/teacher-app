# Layah — Technical SEO Audit (baseline)

Audited 2026-10-23 against `main` @ `37e3bd7` and the live site `https://www.layah.in`.

## Stack

Next.js 16.2 (App Router, Turbopack), React 19, Tailwind 4, deployed on Vercel. Supabase auth is enforced client-side by `AppShell` (plus role gates in a few server pages). Analytics already present: PostHog (proxied via `/ingest`). Email: nodemailer over Hostinger SMTP. CSP is set in `next.config.ts`.

## Public vs private routes

| Public, indexable (in sitemap) | Public, noindex | Private / auth-only |
|---|---|---|
| `/`, `/pricing`, `/about`, `/blog`, `/blog/[slug]` (11), `/faq`, `/contact`, `/privacy`, `/terms` | `/login`, `/signup`, `/overview` (already noindex) | `/dashboard`, `/settings`, `/my-lesson-plans[/id]`, `/onboarding`, `/school-admin`, `/hod-dashboard`, `/super-admin`, `/lesson-plan`, `/question-paper`, `/differentiated-worksheets`, `/api/*`, `/auth/*` |

`/landing` is a legacy alias of `/`.

## Status of the 20 requirements at baseline

| # | Requirement | Baseline | Notes / files |
|---|---|---|---|
| 1 | Server-side rendering | **Broken** | Every public page except `/` shipped an empty `<div aria-hidden>` in initial HTML (live-verified: no `<h1>`, `BAILOUT_TO_CLIENT_SIDE_RENDERING`). Cause: `src/components/layout/app-shell.tsx` renders nothing until a client session check resolves. |
| 2 | robots.txt | Present, wrong host, no staging protection | `src/app/robots.ts` |
| 3 | sitemap.xml | Present, wrong host (apex redirects to www), fake `lastModified: new Date()` | `src/app/sitemap.ts` |
| 4 | Unique titles | Present | per-page `metadata`; template `%s \| Layah` |
| 5 | Meta descriptions | Present, unique | per-page; contact page claims "replies within 24 hours" (owner to confirm) |
| 6 | One H1 | Present in source; invisible to crawlers because of #1 | |
| 7 | Canonicals | **Missing** | |
| 8 | OG images | Weak: 512px logo, blog posts had none | `src/app/layout.tsx` |
| 9 | Custom 404 | Present, true 404; broken dark-mode button, links to sign-in-only pages | `src/app/not-found.tsx` |
| 10 | 301 redirects | `/landing` was a 307 `redirect()`; apex→www is 307 (Vercel setting) | |
| 11 | Alt text | Fine: meaningful images have alt, decorative use `alt=""` | |
| 12 | WebP | Few raster images (logos); `next/image` already serves WebP/AVIF | |
| 13 | Lazy loading | `next/image` lazy by default; navbar logo `priority`; footer badge was eager | |
| 14 | Organization schema | Present (root layout), apex URLs | |
| 15 | Breadcrumbs | **Missing** | |
| 16 | Internal links | Present (navbar, footer, home) | |
| 17 | Google Analytics | **Missing** (PostHog only, not consent-gated) | |
| 18 | Search Console | HTML-file verification file exists (`public/google4767da2906b43ae2.html`); whether the property is verified is unknown | |
| 19 | Privacy Policy | Present at `/privacy`, linked from footer + cookie banner | does not name specific vendors or GA |
| 20 | Contact form | UI + API present, but API ignored `sendEmail`'s result (reported success when SMTP failed), unescaped HTML in email, no server validation, no honeypot, reply-to pointed at the sender account | |

Also found: commit `37e3bd7` on `main` ends five files with a stray literal `\n` and **does not compile**. The uncommitted working tree already fixes it; the SEO branch carries the identical fix as its own commit.
