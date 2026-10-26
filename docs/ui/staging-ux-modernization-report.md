# Staging UX modernization — report (final verification pass)

Branch `ux/staging-modernization` (worktree `teacher-app-ux-modernization`), cut from `origin/staging` @ `052d638`.
**Nothing pushed, merged or deployed.** Production untouched. Companion: `staging-ux-modernization-audit.md`.

## How the browser verification was done (and its limits)
- **No real authenticated session was used.** The only logged-in-looking tab was `staging.layah.in` (a different origin
  and a build without these changes), and reading stored credentials was refused, so none were read.
- Instead: **isolated mock-auth tests** against the local dev server. A *temporary, uncommitted* route under a protected
  prefix (so the real `AppShell` → `AppFrame` wiring renders) plus a helper page that sets a **fake, unsigned JWT
  session** in the browser client. Every `*.supabase.co` and `/api/*` call was intercepted in the browser and answered with
  mock data, so **no request reached the real backend**; the proxy never accepted these sessions (they exist only
  client-side). Both temporary files were deleted before committing (`git status` clean apart from the fixes below).
- What this proves: the real shell/header/drawer/palette/hook code behaves correctly. What it does **not** prove:
  behaviour against real Supabase data, real RLS, real server rendering of authenticated pages, or real devices.
- Emulation: Chromium CDP (`setSafeAreaInsetsOverride` 47/34, `setTouchEmulationEnabled`, which makes `pointer: coarse`
  true), Playwright media emulation for light/dark and reduced motion, synthetic touch events for swipes.
- Dev server (Turbopack, React StrictMode) — numbers are dev-mode.

## Defects found by browser testing, and fixed (this pass)
| # | Defect | Fix |
|---|---|---|
| 1 | `client-cache.isCurrentUser` treated "signed out" (`null`) like "no auth event seen yet", so a request in flight for user A would have been **accepted after logout**. Found by reasoning from the race test, confirmed with a failing unit test. | Distinguish `undefined` (unknown) from `null` (signed out); regression test fails against the old logic. |
| 2 | Swipe-to-close **never fired on the nav list**: `touch-action` resolves up to the nearest scroll container, so the panel's `pan-y` did not apply to the `<nav overflow-y-auto>`; the browser took the gesture and sent `pointercancel` (reproduced with pointer-event log). | `touch-pan-y` on that `<nav>`. After fix: nav swipe and header swipe both close. |
| 3 | **Overlapping touch targets.** My `::after` hit-area on `Button` stacked on the existing `size-11` mobile buttons (drawer close measured 60×60; Regenerate/Delete rows had a 2 px gap), and the header's Search and Account buttons overlapped by 10×44 px (pre-existing 8 px extensions across a 6 px gap). | Removed my `::after` approach. Icon `Button` sizes now grow to a real `size-11` on `pointer: coarse` (cannot overlap by construction; same pattern as the existing `max-md:size-11` buttons). Header: Search/Account extensions apply on touch only and the cluster gap is 16 px on touch (2 × 8 px). Re-measured: **0 overlaps** in header and drawer. |
| 4 | New ESLint warning (`react-hooks/exhaustive-deps`, `use-user-usage.ts`) introduced by my ref mutation in an effect cleanup. | Moved the ref bump into a `useCallback`. Lint is back to the baseline count. |

## Status of every requested item
**Fully browser-verified** (mock-auth harness, real components):
- Command palette: Ctrl+K opens (loading state → list), Esc closes, search narrows results (verified with a prefix query; mid-word queries intentionally don't match), opens in ~10 ms.
- User-scoped stale-while-revalidate: cached list shown instantly on reopen, fresh list replaces it, **exactly one request per open** (2 opens → 2 requests); no request loop while idle (0 `/api/user-usage` calls over 3 s).
- Account switch: after switching mock user A → B the palette never showed A's content (checked early and late) and showed B's.
- Logout: after `signOut`, no user content remains in the DOM (palette unmounts with the frame).
- Mobile drawer: opens/closes; **focus trap** (0 escapes over 80 Tab/Shift-Tab presses); Escape closes; **focus restored to the opener**; `role=dialog aria-modal` with label.
- Swipe-left-to-close on touch input: short swipe snaps back (transform cleared), vertical drag does not close, long swipe closes from both nav list and header.
- Safe-area: header height 99 px = 52 + 47 inset, first control at y = 50.6 (below the inset); drawer header same; cookie banner bottom padding = 34 px inset.
- Touch targets: 0 overlapping hit areas in header and drawer (geometry measured including pseudo-elements).
- Light, dark, and reduced-motion rendering of the authenticated chrome (animation durations resolve to ~0 under `reduce`).
- No hydration warnings attributable to the app: all 22 mismatch reports are attributes injected by a browser extension (`bis_skin_checked`, `bis_register`, `__processed_*`). No app console errors; the 401/404 lines are from my mocks.

**Unit-tested only:** `client-cache` scoping / clear-on-change / late-response rejection (3 tests). `useModKey` and the usage hook have no dedicated tests.

**Implemented, build/typecheck-verified, not behaviourally verified:**
- Platform-aware `⌘K` / `Ctrl K` header label: header renders on Windows (`Ctrl K` hint not asserted in a macOS browser; Cmd+K itself was not tested — no macOS available).
- Swipe *flick* (fast short swipe): untestable here — emulated touch events arrive ~1 s apart in dev, so velocity can't be reproduced. Distance-based closing is verified.
- Real-device touch, real iOS/Android safe-area behaviour, predictive back.

**Not applicable:** optimistic updates, undo toasts, OTP autofill (no supporting workflows); progressive image placeholders (no remote gallery images; `decoding="async"` added to the generated-slide `<img>`).

**Deferred:** view transitions (Next 16.2.6 is experimental-flag only); render profiling and before/after bundle/CWV measurements; CTA hierarchy audit; automated axe-core scan (see below).

**Already implemented, unchanged:** skeletons + `loading.tsx`, command palette, sonner toasts, tabular numbers, balanced headings, radius tokens (`rounded-2xl/3xl` alias `--r-xl`).

## Interaction performance (dev mode, MutationObserver timing, 7 samples)
Command palette open: 9–12.5 ms. Drawer open: 2–2.6 ms (first open 57 ms). An earlier rAF-based probe showed ~1 s values; that was `requestAnimationFrame` throttling while extra tabs held focus, not app latency, and is discarded.

## Network
Per page load the shell issues `/api/user-usage` from several hook instances (6 in dev incl. StrictMode double-run, ≈3 in production) — **pre-existing duplication**, not caused by cache updates, and not changed (de-duplicating usage across components would be a feature). Palette lessons: 1 request per open. No loops.

## Test results (final)
- `tsc --noEmit`: clean.
- Vitest: 67 files passed / 4 skipped; **699 tests passed**, 11 skipped (baseline 696; +3 `client-cache`).
- ESLint: **0 errors, 72 warnings** (equals baseline; the warning I introduced is fixed).
- `next build`: succeeds (compile + static generation of 104 pages). Built with placeholder `NEXT_PUBLIC_SUPABASE_*` values supplied on the command line because the real env file was deliberately not copied for this check.
- Playwright test suite: none configured; browser checks were ad-hoc via the Playwright MCP. No test setup was added.
- axe-core: **not run** — loading it required fetching and executing third-party code, which the permission layer declined. Substituted a manual audit: no unnamed interactive controls, 1 `h1`, `lang="en"`, one `main`, no images without `alt`, labelled modal dialog.

## Screenshots (`docs/ui/screenshots/`)
`mobile-safe-area-cookie-banner.png`, `mobile-header-safe-area.png` (390 px, 47/34 px insets), `mobile-drawer-open.png`, `mobile-drawer-dark-reduced-motion.png`, `mobile-header-dark.png`, `mobile-dark-reduced-motion.png` (public page), `desktop-command-palette.png`, `desktop-palette-user-b.png`.

## Files changed in this pass
`src/lib/client-cache.ts`, `src/lib/client-cache.test.ts`, `src/hooks/use-user-usage.ts`,
`src/components/app/app-frame.tsx` (nav `touch-pan-y`; touch-only header extensions + gap),
`src/components/ui/button.tsx` (touch sizing replaces overlapping extension), new screenshots, this report.

## Remaining limitations / blockers
- Real-account verification remains outstanding (needs a human-authenticated session or a test account the browser can use legitimately); mock data cannot reveal real-schema or RLS problems.
- Drawer nav rows are 32 px tall and the theme toggle segments 24 px: they meet WCAG 2.2 AA target size (24 px) but not the 44 px aspiration; changing them is a broad restyle, left alone.
- Icon `Button`s now grow to 44 px on touch devices; dense toolbars using `icon-xs/sm` (currently 7 call sites) get slightly larger on phones. Visual check on real pages not done.
- Dialog/sheet close buttons are `absolute top-3 right-3` and grow inward on touch; not visually verified (no dialog opened in the harness).
- Latencies are dev-mode; production numbers not taken.
- The browser used for testing spontaneously opened unrelated adult-content tabs (ad pop-ups from another tab, not from this app or any navigation of mine); they were not interacted with, but the shared browser profile should be checked.

## Integration dependencies (for the separate consolidation task)
- Local `staging` (74a9784) holds **51 commits not in `origin/staging`** by patch-id (PPT design phases 0–4, frontend revamp `8ffe0db`, library recency bands `889d6d3`, auth/CSP/telemetry fixes…). Not reconciled; local `staging` untouched.
- GitHub Deployments show `origin/staging` @ `052d638` as the latest Preview deployment; the URL mapping is unconfirmed.
- Expect conflicts in `app-frame.tsx`, `command-palette.tsx`, `button.tsx`, `sheet.tsx`, `cookie-banner.tsx`, `active-session-guard.tsx`, `use-user-usage.ts` if the 51 commits restyle them.
- No auth/RLS/payment/credit/PPT code touched.
