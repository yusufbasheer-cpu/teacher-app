# UI Flow — QA Walkthrough

> QA pass over every route in `docs/architecture.md`, done unauthenticated against the local dev server (`http://localhost:3001` — **not** 3000; see caveat below). No login credentials were available in this session, so authenticated-only screens (dashboard content, saved lesson plans, admin panels) were only observed at the "not logged in" gate, not their logged-in state.
>
> **Updated 2026-07-28 — live browser pass.** Re-ran this walkthrough with the Playwright MCP server (installed earlier this session) instead of `curl`, closing the console-error/JS-behavior gap the previous pass flagged. Every route below was actually rendered in a real browser (desktop 1280×800 + mobile 390×844 for the nav), with console messages captured on each page.

## 0. Caveats on how this was tested

- **Port**: `npm run dev` runs on **3001** (`next dev -p 3001`), not the default 3000. Visiting `localhost:3000` gets connection-refused.
- **Live browser used** (Playwright MCP, Chromium). Console messages (all levels) were captured per-page; a mobile viewport pass checked the hamburger menu; a nonexistent route was visited to confirm 404 behavior.
- Still no login credentials in this session, so logged-in-only UI (real dashboard content, saved lesson plans, admin panel data) was not observed — only the logged-out gate/redirect for each.

## 1. Navigation structure

Global layout (`src/app/layout.tsx`) wraps every route in: Sentry → PostHog → SoundProvider → `AppEffects` (cursor/particle effects) → `NavbarWrapper` → `ActiveSessionGuard` → `PageTransitionWrapper` (page fade-in) → `CookieBanner`.

**Header** (`src/components/layout/navbar.tsx`): sticky top bar, shown on every route **except `/landing`** (`NavbarWrapper` returns `null` there — `/landing` renders its own `<Navbar />` inline instead, confirmed live: the same nav markup and links appear on `/landing` as everywhere else). Nav links come from one source of truth, `src/lib/app-nav-links.ts`, and matched exactly what rendered in the browser:

- Home (`/`) · Generate Lesson Plan (`/lesson-plan`) · Question Paper (`/question-paper`) · Differentiated Worksheet Pack (`/differentiated-worksheets`) · Pricing (`/pricing`) · My Lessons (`/my-lesson-plans`) — always shown
- **School Admin** (`/school-admin`) — only if `/api/school-admin/me` says the user is a school admin
- **HOD Dashboard** (`/hod-dashboard`) — only if `/api/hod/me` says so
- **Super Admin** (`/super-admin`, red-styled) — only if `/api/super-admin/me` says so
- Logged in: extra "Dashboard" link → `/lesson-plan` (not `/dashboard` — see §3 note) + Logout button
- Logged out: Login (`/auth`) + Sign Up (`/auth?tab=signup`)
- **Mobile (390px)**: verified live — the header collapses to a logo + "Toggle navigation menu" button; clicking it expands the identical link set (Home, Generate Lesson Plan, Question Paper, Differentiated Worksheet Pack, Pricing, My Lessons, Login, Sign Up) inline below the header. No console errors on open/close.

**Footer** (`src/components/layout/footer.tsx`) — Company / Features / Support link columns + social icons + a Product Hunt badge. **Only mounted on 6 of ~20 pages**: `/landing`, `/about`, `/faq`, `/contact`, `/blog`, `/blog/[slug]`. Every other route (all the generator tools, pricing, privacy/terms, auth, dashboard, settings, admin surfaces) has no footer — see §4.

## 2. Route-by-route results

Every route from `docs/architecture.md` was navigated to directly in the browser:

| Route | Result | Console |
|---|---|---|
| `/` | Redirects to `/landing` | Clean |
| `/landing` | Full marketing homepage renders | Clean |
| `/about`, `/faq`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/blog` | All render real content | Clean |
| `/blog/how-much-time-teachers-spend-lesson-planning` (sample post) | Renders full article | Clean |
| `/auth` | Login/signup form renders (email, password, submit, "Continue with Google"); Turnstile captcha loads with no errors | Clean |
| `/dashboard` | **Client-side redirects to `/auth`** when logged out (URL changes from `/dashboard` → `/auth`) | 1 dev-only warning (see below) |
| `/lesson-plan`, `/question-paper`, `/differentiated-worksheets` | **Full page shell renders and stays** — real headings and form UI render, URL does not change. Protection is client-side/API-side only, not a redirect, so a logged-out visitor briefly sees the full tool UI. | Clean |
| `/my-lesson-plans` | Renders (skeleton/fade-in shell, no redirect) | Clean |
| `/settings` | **Client-side redirects to `/auth`**, same as `/dashboard` | 1 dev-only warning (see below) |
| `/school-register` | "Register Your School" form renders directly, no auth gate | Clean |
| `/hod-dashboard` | **Redirects to `/auth`** (server-side — URL is `/auth` on first paint, no flash of gated content) | Clean |
| `/school-admin` | **Redirects to `/auth`**, same as above | Clean |
| `/super-admin` | **Redirects to `/auth`**, same as above | Clean |
| `/this-page-does-not-exist` (sanity check) | Proper custom 404 page — "Page not found" heading, explanation text, and Home / Lesson generator / Question Paper links. Real HTTP 404 status. | 1 expected error: the browser's own "Failed to load resource: 404" for the page request itself — not an app bug |

**Dev-only console warning** (appears on `/dashboard` and `/settings`, i.e. pages that redirect to `/auth` mid-render):
```
Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling
during route transitions, add `data-scroll-behavior="smooth"` to your <html> element.
```
This is a genuine (if minor) Next.js App Router recommendation — `smooth` scroll-behavior is set somewhere (global CSS or Tailwind base) but the `<html>` tag in `src/app/layout.tsx` is missing `data-scroll-behavior="smooth"`, which Next.js wants so it can skip its own scroll restoration during client-side route transitions. Cosmetic/dev-only (Next.js strips this warning in production), but a one-line fix in `layout.tsx` if you want it gone.

No other console errors or warnings appeared on any of the 20 routes tested.

**No broken links.** No 404s or console errors among internal `href`s actually rendered on the pages tested. The `href="#how-it-works"` anchor on `/landing` scrolls correctly to its target section.

**Duplicate-target links** (not broken, but worth a UX look): on `/landing`, the footer's "Features" column sends both "PPT Generator" and "Activity Sheet AFL" to `/lesson-plan` — same target as "Lesson Plan Generator". If those are meant to be distinct features, they currently have no distinct destination.

## 3. Notable inconsistency: two different "post-login" destinations

- `docs/architecture.md` and `/auth/callback` describe `/dashboard` as the post-login landing page.
- The navbar's own "Dashboard" link (when logged in) points to `/lesson-plan`, not `/dashboard`.

Both routes exist and both work, but a user clicking "Dashboard" in the header never actually lands on `/dashboard` — worth confirming with your teammate whether `/dashboard` is legacy (kept alive only for the OAuth-callback redirect-through) or whether the navbar link is a stale reference.

## 4. Repeated UI patterns

- **Page-level fade/slide-in on mount** — `PageTransitionWrapper` (opacity-only fade, global, wraps every route) plus `FadeIn` / `PageTransition` / `StaggerChildren` / `SlideIn` in `src/components/ui/animate.tsx`, all built on the same Framer Motion easing curve. Used throughout marketing pages and generator result panels.
- **Shimmer `Skeleton` loading placeholders** (`src/components/ui/animate.tsx`) — used while a page's real content is still being fetched (matches what was observed on `/my-lesson-plans`).
- **Scroll-triggered count-up stats** — the "Layah in Numbers" section on `/landing` renders `0+`/`0` for every stat until scrolled into view, then animates up to its real value (e.g. `15+` Curriculums Supported, `25+` Subjects Available). Confirmed live by scrolling the section into view. Worth knowing if you're QA-ing via a quick static screenshot — the zeros look like a bug but aren't.
- **Card-in-`Container`** — nearly every page wraps content in `src/components/ui/container.tsx` for consistent max-width/padding.
- **Teal/navy brand pair** (`#00C6A7` teal, `#0A1628` navy) hardcoded as inline `style` colors repeatedly across navbar, footer, headings, and CTAs, rather than centralized in a Tailwind theme/token file — every new page currently re-declares these hex values by hand.
- **Sound-effect hooks** (`useLayahSounds`, `playWhooshSound`) fired on route transitions and button interactions, gated by a single global `SoundContext` toggle.
- **Inconsistent footer coverage** — see §1; six pages get the footer, the rest don't.
- **Auth-gated pages follow one of two shapes**: either (a) full page shell renders immediately and gating happens after data loads (`/lesson-plan`, `/question-paper`, `/differentiated-worksheets`, `/school-register`, `/my-lesson-plans`), or (b) a client-side redirect to `/auth` fires before/while rendering (`/dashboard`, `/settings`). Worth standardizing if consistency matters — right now it's a per-page choice, not a shared pattern.

## 5. Components likely shared/reusable across the app

Based on where they're imported from and how generic they are:

| Component | Path | Used by |
|---|---|---|
| `Navbar` / `NavbarWrapper` | `src/components/layout/` | Every route except (nominally) `/landing`, which inlines its own copy |
| `Footer` | `src/components/layout/footer.tsx` | 6 marketing/content pages |
| `Container` | `src/components/ui/container.tsx` | Nearly all pages, for layout width/padding |
| `PageTransition`, `FadeIn`, `StaggerChildren`, `SlideIn`, `Skeleton`, `Presence` | `src/components/ui/animate.tsx` | Any page needing entrance animation or loading state |
| `PageTransitionWrapper` | `src/components/layout/page-transition-wrapper.tsx` | Global, via root layout |
| `LegalPageLayout` | `src/components/legal/legal-page-layout.tsx` | `/privacy`, `/terms` |
| `ActiveSessionGuard` | `src/components/auth/active-session-guard.tsx` | Global, via root layout — the single-active-device-session enforcement |
| `SoundToggleButton` / `SoundProvider` | `src/components/effects/` | Global (navbar toggle + root provider) |
| `GenerationUsageIndicator`, `UpgradeUsageIndicator`, `GenerationLimitModal` | `src/components/usage/` | All three AI generator pages, driven by the shared `useUserUsage` hook |
| `CookieBanner` | `src/components/layout/cookie-banner.tsx` | Global |
| `AppEffects` (cursor/particles) | `src/components/effects/app-effects.tsx` | Global |
| `ErrorBoundary` | `src/components/ui/error-boundary.tsx` | Likely wraps generator/result panels where a bad AI response could throw |

## 6. Suggested follow-ups

1. Re-run this pass logged in as a real teacher account, to see actual dashboard content, `/my-lesson-plans` data, and generator flows end-to-end (form submission, AI generation, export).
2. Clarify whether `/dashboard` or `/lesson-plan` is the intended "home base" after login (§3) — right now the navbar and the OAuth callback disagree.
3. Decide if footer coverage (§1/§4) should be extended to the generator/account pages, or if that's intentional (e.g. to keep tool pages focused/full-height).
4. Optional cosmetic fix: add `data-scroll-behavior="smooth"` to the `<html>` tag in `src/app/layout.tsx` to silence the Next.js dev warning noted in §2.
