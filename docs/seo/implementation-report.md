# Layah — SEO Implementation Report

Branch `seo/technical-seo` (worktree `C:\Liyaah\teacher-app-seo`), cut from `main` @ `37e3bd7`. Nothing pushed, merged or deployed. See [technical-seo-audit.md](technical-seo-audit.md) for the baseline.

"Verified" below means checked against a local production build (`next build` + `next start`, dummy Supabase env, `VERCEL_ENV=production`) with `scripts/seo-check.mjs` (all checks pass), unless stated.

## Status of the 20 items

| Requirement | Previously present | Implemented | Verified | Remaining action |
|---|---|---|---|---|
| 1 SSR | Broken on all pages but `/` | `AppShell` renders public routes immediately (protected routes keep the placeholder) | Yes, local build: real H1/content in initial HTML on all 8 pages | Deploy, then re-run `node scripts/seo-check.mjs https://www.layah.in` |
| 2 robots.txt | Yes (apex host) | www sitemap, more private paths, full `Disallow: /` when `VERCEL_ENV !== production` | Yes (unit tests + local) | Confirm preview URL serves `Disallow: /` after deploy |
| 3 sitemap | Yes (apex, fake dates) | www URLs, no fake `lastModified`, blog dates kept | Yes | Submit in Search Console |
| 4 Titles | Yes | unchanged | Yes, unique across 8 pages | Brand wording kept as deployed ("AI Lesson Planning for Teachers"), not "AI Teaching Assistant" — say if you want it changed |
| 5 Descriptions | Yes | unchanged | Yes, unique | Owner to confirm "replies within 24 hours" claim on /contact |
| 6 One H1 | Yes | unchanged | Yes, exactly one per page in initial HTML | — |
| 7 Canonicals | No | `alternates.canonical: "./"` in root layout → per-page, query strings dropped | Yes | — |
| 8 OG images | Weak | 1200×630 `public/og-image.png` built from `Logo.png` (`scripts/generate-og-image.mjs`), also on blog posts, Twitter card | Tags verified; image not viewed in a real social debugger | Check with Facebook/LinkedIn debuggers post-deploy; swap for designed art if wanted |
| 9 404 | Yes | dark-mode fix, links to public pages, `noindex` | Yes: HTTP 404, light + dark, mobile | — |
| 10 Redirects | `/landing` 307 | `/landing` → `/` 308 in `next.config.ts` | Yes | **Manual:** set Vercel domain redirect `layah.in` → `www.layah.in` to *permanent* (currently 307) |
| 11 Alt text | Yes | no change needed | Reviewed in source | — |
| 12 WebP | Via `next/image` | none needed (no large raster assets) | n/a | — |
| 13 Lazy loading | Mostly | footer badge `loading="lazy"` | Source only | — |
| 14 Organization schema | Yes | www URLs, `ContactPoint` (info@layah.in, from footer), shared constants | JSON-LD present on every page; **not run through Google's Rich Results Test** | Run Rich Results Test |
| 15 Breadcrumbs | No | `Breadcrumbs` (visible, legal pages + blog posts) and `BreadcrumbJsonLd` (about, pricing, faq, contact, blog) | Yes: JSON-LD on all non-home pages; visible version checked in dark mode | Visible crumbs not added to hero-style pages to avoid altering their design |
| 16 Internal links | Yes | 404 now links to public pages | Smoke check: every sitemap URL returns 200 | — |
| 17 Google Analytics | No | `GoogleAnalytics` component: env-driven, loads only after cookie "Accept", manual page_view per pathname change (deduped), no query strings, skips private routes; CSP updated | Logic unit-tested; **GA was not loaded in a browser against a real property** | **Manual:** create GA4 property, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel, then verify in GA Realtime. Update the Privacy Policy first (below) |
| 18 Search Console | HTML file in `public/` | optional `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` meta tag support | Not verifiable from here | **Manual:** see below |
| 19 Privacy Policy | Yes | not edited (it is live legal text) | Reachable, in footer, now has breadcrumbs | **Owner/legal review needed:** policy says generic "analytics, AI APIs, email" providers; it should name the real vendors (Supabase, DeepSeek, fal.ai, Pexels, Razorpay, PostHog, Sentry, Cloudflare Turnstile, Google Analytics, Hostinger SMTP, Vercel) and the cookie section must cover GA. I did not draft claims about retention/jurisdiction |
| 20 Contact form | UI + API existed | server validation, HTML escaping, honeypot, per-IP + per-email rate limits, real failure handling (502 if mail not sent), reply-to = visitor | Validation, honeypot, rate limit, and failure path verified locally. **Delivery to the inbox NOT tested** — SMTP was intentionally unset and no test mail was sent to info@layah.in | **Manual:** with your approval, submit one test message on the deployed site and confirm it reaches info@layah.in |

## Search Console steps (not performed)

1. https://search.google.com/search-console → Add property. Prefer **Domain** (`layah.in`, DNS TXT record at your registrar), which covers www and apex. Or **URL prefix** `https://www.layah.in`, which can use the existing `google4767da2906b43ae2.html` file (still served at `/google4767da2906b43ae2.html`) or an HTML tag via `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
2. After verification: Sitemaps → submit `https://www.layah.in/sitemap.xml`.
3. URL Inspection → request indexing for `/` and `/pricing`.

## Files changed

New: `src/lib/site.ts`, `src/lib/contact-form.ts`, `src/lib/analytics-consent.ts`, `src/components/analytics/google-analytics.tsx`, `src/components/layout/breadcrumbs.tsx`, `src/app/{about,pricing}/layout.tsx`, `public/og-image.png`, `scripts/{generate-og-image,seo-check}.mjs`, `src/lib/seo.test.ts`, `docs/seo/*`.
Modified: `src/components/layout/app-shell.tsx`, `src/app/{layout,robots,sitemap,not-found}.ts(x)`, `next.config.ts`, `src/app/api/contact/route.ts`, `src/lib/send-email.ts` (optional `replyTo`), `src/app/contact/{page,layout}.tsx`, `src/app/faq/layout.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/{login,signup,privacy,terms}/page.tsx`, `src/components/legal/legal-page-layout.tsx` (new required `path` prop), `src/components/layout/{cookie-banner,footer}.tsx`, plus the 5-file `\n` compile fix.

## Behaviors worth knowing

- Canonicals always point at production `www.layah.in`, even on previews; previews are kept out of the index by robots `Disallow: /`. (A page-level `noindex` header for previews was not added.)
- `/login`, `/signup` are `noindex,follow` and deliberately not blocked in robots.txt so crawlers can see the tag. Robots rules are hints; auth is what protects private routes.
- The cookie banner was unreadable in dark mode (light background, white text) and the contact hero likewise; both now use theme tokens.
- PostHog still initialises without waiting for cookie consent (pre-existing). Worth a decision alongside the GA change.

## Not done / not measured

- **Lighthouse / Core Web Vitals: not run.** No baseline or after numbers exist; none are claimed. Run Lighthouse against the deployed preview.
- No real GA, Search Console, or contact-delivery test (see above).
- Mobile/tablet/desktop visual checks covered 404, contact, privacy at mobile width in light/dark; tablet and desktop were not screenshotted.

## Tests

`npx vitest run`: 42 files, 453 tests pass (14 new in `seo.test.ts`). `tsc --noEmit` clean. `next build` succeeds. `scripts/seo-check.mjs` against the local build: all checks pass.

## Git

Branch `seo/technical-seo`; commits listed in the final message. Your uncommitted Gamma work in `C:\Liyaah\teacher-app` was not touched.
