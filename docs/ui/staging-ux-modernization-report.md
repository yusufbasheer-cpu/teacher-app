# Staging UX modernization — report

Branch `ux/staging-modernization` (worktree `teacher-app-ux-modernization`), cut from `origin/staging` @ `052d638`.
**Nothing pushed, merged or deployed.** Production untouched. Companion: `staging-ux-modernization-audit.md`.

## Integration dependencies (for the separate consolidation task)
- Local `staging` (74a9784) holds **51 commits not in `origin/staging`** (by patch-id): PPT design phases 0–4
  (layout registry, layout budgets, presentation preview/download UI hardening), the "frontend revamp" commit
  `8ffe0db`, library recency bands `889d6d3`, auth/CSP/telemetry fixes, and others. Some may be superseded by the
  rebased history on `origin/staging`; this was **not** reconciled. Local `staging` is preserved unchanged.
- GitHub Deployments show `origin/staging` @ `052d638` as the latest **Preview** deployment (2026-10-25). I could not
  confirm which URL maps to it (Vercel CLI/MCP not authorised here), so "deployed to the intended staging URL" is
  **unconfirmed**.
- This branch edits `app-frame.tsx`, `command-palette.tsx`, `button.tsx`, `sheet.tsx`, `cookie-banner.tsx`,
  `active-session-guard.tsx`, `use-user-usage.ts`; expect conflicts if the 51 commits (notably the revamp commit)
  restyle the same files.
- Security phase 1/2 worktrees are not merged here; no auth/RLS/payment/credit/PPT code was changed.

## Commits (local, on top of origin/staging)
| SHA | Content |
|---|---|
| c094f8b | safe-area insets, tabular usage figures, audit |
| f6cb5d8 | user-scoped stale-while-revalidate (`client-cache` + tests), race-safe usage hook, palette caching |
| 4fff474 | drawer focus trap, swipe-to-close, platform-aware shortcut hint, touch hit areas |
| (this commit) | report, screenshots, `decoding="async"` on generated slide image |

## Status of every requested item
Legend: **IV** implemented & verified · **AIV** already implemented & verified · **P** partial · **NA** not applicable · **D** deferred

| Item | Status | Detail |
|---|---|---|
| Render profiling / optimization | **D** | Not done. Profiling needs an authenticated session; reading the test-account credential was blocked by the permission classifier and I did not work around it. No speculative memoization added. |
| Progressive image placeholders | **NA / P** | No remote image galleries exist: slide previews are data URLs extracted from generated PPTX, template thumbnails are base64, logos use `next/image`. BlurHash would add a dependency for nothing. Added `decoding="async"` to the one generated-image `<img>`; previews already reserve space with `cqw` boxes. |
| Platform-aware shortcut hint | **P** | Header shows `⌘K` on Apple, `Ctrl K` elsewhere (`useModKey`, `useSyncExternalStore`, SSR-safe). Typechecked and built; **not browser-verified** (authenticated header). |
| Drawer focus trap & restore | **P** | `useFocusTrap`: focus in, Tab/Shift-Tab trap, restore to opener. No unit test; **not browser-verified** (needs login). |
| Touch targets | **P** | Icon `Button` sizes get an invisible `::after` hit area to ≥44px on `pointer: coarse` only; drawn size unchanged. Known limit: adjacent icon buttons closer than the slop overlap by a few px. Not measured on a device. Raw `<button>`s were not swept. |
| Drawer swipe | **P** | `useSwipeToClose`: touch-only, claims the gesture only when clearly leftward-horizontal, follows the finger, closes past 35% width or on a flick, else snaps back; `touch-pan-y` keeps vertical scroll. **Not verified with touch input.** Bottom-sheet swipe (original #13) is NA: `Sheet` has no consumers. |
| CTA hierarchy | **D** | Not audited screen-by-screen this round; `Button` already encodes rank (one filled primary). |
| Form states | **P** | Existing: inline validation, double-submit guards (generator controls disabled while `loading`), `beforeunload` guard in studio. No success/loading input variants added; no screen currently needs them. |
| Consistent radii | **AIV (code)** | `rounded-2xl/3xl` already alias the `--r-xl` token in `globals.css`, so legacy classes resolve to the scale. No change needed. |
| Interruptible animations | **AIV (code)** | Motion is CSS transition/keyframe (interruptible, non-blocking); the drawer closes instantly with no exit queue. Not instrumented in a browser. |
| Safe navigation transitions | **AIV (code)** | `beforeunload` + `onBeforeNavigate` guard in studio, `loading.tsx` per route, no history traps found. Not exercised in a browser (login). |
| Stale-while-revalidate | **IV (unit) / P (browser)** | `src/lib/client-cache.ts`: entries keyed by user id; cleared on `SIGNED_OUT` or user change; `isCurrentUser` drops late responses. Palette shows cached lessons instantly, revalidates on every open, keeps stale rows on error, and is invalidated after a lesson delete. 2 unit tests. `useUserUsage` is deliberately **not cached** (credits/plan): it keeps the last value during refresh, ignores superseded, unmounted and other-account responses, and resets on account change. Not exercised against a live session. |
| View transitions | **D** | Next 16.2.6 exposes `experimental.viewTransition` only; deferred per your decision. |
| Safe-area | **IV (cookie banner) / P (rest)** | Chromium `Emulation.setSafeAreaInsetsOverride` (top 47 / bottom 34), 390×844: cookie banner padding-bottom = 34 px, 33.7 px gap below the card, no horizontal scroll. Header, drawer, sheet and session banner use the same pattern but are authenticated-only or transient → **not browser-verified**. |
| Skeletons, palette, toasts, typography | **AIV (code)** | Kept unchanged. Reduced motion verified in browser: shimmer/animations resolve to 0.00001 s, 1 iteration. |
| Optimistic updates, undo toasts, OTP autofill | **NA** | No rename/favourite/archive, only permanent delete behind a confirm dialog; no OTP form. |
| Tabular numbers | **P** | Added to both usage indicators (code only; authenticated). |

## Verification results
- `tsc --noEmit`: clean.
- Vitest: 67 files passed, 4 skipped; **698 tests passed**, 11 skipped (baseline 696; +2 cache tests).
- ESLint: 0 errors, **73 warnings** (baseline 72; one new warning of the existing `set-state-in-effect` kind, not individually located).
- `next build`: succeeds.
- Playwright: not configured in the repo; ad-hoc Playwright-MCP checks on public `/landing` only.
- Browser (public pages, mobile 390×844): light and dark render; reduced motion; keyboard Tab shows a visible indicator (ring box-shadow) on 5 of 6 stops, the 6th was ambiguous in my probe and is unverified. Console: only dev-server HMR WebSocket refusals (`ws://localhost:3077`); no app errors or hydration warnings seen.
- Screenshots: `docs/ui/screenshots/mobile-safe-area-cookie-banner.png`, `docs/ui/screenshots/mobile-dark-reduced-motion.png`.
- Before/after render profiling, bundle size, Core Web Vitals, axe: **not measured**.

## Not verified: needs an authenticated session
Drawer focus and swipe, header shortcut hint, palette caching, usage hook behaviour, header safe-area, and flows
1–20 of the original test list beyond public pages. To finish: allow reading the test-account password in this
session, or log in manually on `npm run dev` (port 3002 used here) and repeat the drawer/palette checks at 390 px.

## Known limitations
- Touch hit-slop can overlap on tightly packed icon buttons.
- A swipe that starts during the snap-back transition is not special-cased.
- `client-cache` is memory-only (lost on reload) by design.
- The 51 diverged commits may conflict with these edits.
