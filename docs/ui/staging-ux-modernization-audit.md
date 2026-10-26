# Staging UX modernization — audit

Baseline: worktree `teacher-app-ux-modernization`, branch `ux/staging-modernization`, cut from
`origin/staging` @ `052d638` (no upstream set; nothing pushed). Local `staging` (74a9784) has
**diverged** from `origin/staging` (62 ahead / 60 behind) and was *not* used — confirm which is
the intended staging line before merging. Other worktrees (Gamma, SEO, security phase 1/2,
auth) are untouched. Baseline: `tsc` clean, vitest 696 pass / 11 skipped, eslint 0 errors.

Stack facts: Next 16 App Router, React 19, Tailwind 4 + `tokens.css`, base-ui dialog/sheet,
`sonner` (single toast system, `ui/toaster.tsx`), `motion` v13, **no** React Query/SWR (data is
ad-hoc `fetch`/Supabase client calls), no Playwright config, no `cmdk`.

Status key: **Done** = already on staging · **Gap** = work proposed · **Blocked/N/A** = see reason.

| # | Item | Current state (files) | Verdict / proposal | Risk |
|---|------|----------------------|--------------------|------|
| 1 | Skeletons | `ui/panel.tsx` `Skeleton`/`SkeletonRows`, `app/route-skeletons.tsx`, a `loading.tsx` per authenticated route; `.skeleton-shimmer` + global reduced-motion rule | **Done** for routes. Gap: in-page loaders still using spinners (5 files use `Loader2`/`animate-spin`) — review per-flow | low |
| 2 | Optimistic updates | Saved lessons support only **delete** (`my-lesson-plans-list.tsx`). No rename/favourite/archive exists | **Blocked**: adding rename/favourite needs new API + DB column, which the brief forbids. Delete is permanent → must not be optimistic | — |
| 3 | SWR | No cache lib. `use-user-usage.ts`, `use-pricing-region.ts` hand-rolled; palette fetches lessons once | **Gap**, needs a decision: add `swr` (~4 kB) vs. extend the hand-rolled hooks. Must key by user id and clear on logout. Usage/payment status must stay uncached | med (privacy) |
| 4 | Re-render reduction | Not profiled yet | **Gap**: React Profiler pass on `app-frame.tsx` (644 lines), `generation-studio`, `my-lesson-plans-list`; change only what measures | low |
| 5 | Progressive images | Not audited (template galleries) | **Gap**: check `next/image` usage + add `placeholder="blur"` with static blurDataURL; no new lib | low |
| 6 | Command menu | `app/command-palette.tsx` (⌘/Ctrl-K, role-filtered nav, own-lesson search via user session, theme actions) | **Done**; verify focus trap + empty/loading states | low |
| 7 | Shortcut hints | `Kbd` in header trigger (`⌘K`) — hard-coded ⌘ even on Windows | **Gap (small)**: platform-aware label | low |
| 8 | Keyboard consistency | Global `:focus-visible` ring; `ConfirmDialog` traps focus/restores; palette & drawer handle Esc | **Mostly done**; drawer in `app-frame.tsx` has no focus trap/restore | low |
| 9 | Undo toasts | Only destructive action is permanent delete (already `ConfirmDialog`'d) | **N/A**: no reversible list action exists; fake undo is prohibited | — |
| 10 | View transitions | `PageTransitionWrapper` is a deliberate pass-through | **Gap, optional**: enable `experimental.viewTransition` + CSS for list→detail only | med (Next flag) |
| 11 | Interruptible animation | CSS transitions/keyframes (interruptible); `motion` used in places | **Mostly done**; drawer uses keyframe `animate-rise` with no exit animation | low |
| 12 | Safe transitions | `beforeunload` guard + `onBeforeNavigate` in studio; `ConfirmDialog` | **Partly done**; draft preservation on recoverable errors to be verified in generators | med |
| 13 | Swipe-dismiss sheets | `ui/sheet.tsx` exists but has **zero consumers**; mobile nav is a custom drawer | **Gap, low value**: build on the drawer (swipe-left) rather than the unused Sheet | med |
| 14 | Predictive back | Plain Next history; no history traps found | **Done (web)**; native Android predictive-back not applicable until a wrapper exists | — |
| 15 | Hit slop | Mobile inputs 44px (`globals.css`); nav buttons `size-11`; `Button` icon sizes 24–36px | **Partly done**; audit icon buttons on coarse pointers | med (overlap) |
| 16 | Safe-area | **None existed**; viewport lacked `viewport-fit=cover` | **Implemented (this batch)** | low |
| 17 | OTP autofill | **No OTP form exists** (email-link confirmation; PIN gate is `current-password`) | **N/A** — brief forbids adding SMS/OTP | — |
| 18 | Tabular nums | `.tabular`, tables, studio, dashboard, lesson list already | **Gap closed (this batch)**: usage indicators | none |
| 19 | Balanced headlines | `h1–h6 { text-wrap: balance }` global | **Done**; consider `<p>` in empty states | none |
| 20 | Corners | `--r-*` token scale in `globals.css`; mixed `rounded-2xl` in older components (toaster, cookie banner, usage cards) | **Gap**: map legacy `rounded-2xl` to tokens. `corner-shape` is not broadly supported — skip | low |
| 21 | Input states | `ui/input.tsx` (shadcn base), `ui/field.tsx` (262 lines, labels/errors), inline validation shipped in 06f4f13 | **Mostly done**; success/loading states absent | low |
| 22 | Form behaviour | Inline validation, studio guard | **Verify** double-submit + prompt retention on error | med |
| 23 | CTA hierarchy | `Button` has `xl` for page-level primary | **Gap**: per-screen audit | low |
| 24 | Pending feedback | Studio shows real step status, `useErrorToast`/`notify-error` | **Mostly done**; verify no fake percentages | low |
| 25 | Cohesion | One toaster (sonner), one dialog stack (base-ui), `Confirm` | **Done**; no competing libs introduced | — |
| 26 | Perf/a11y safeguards | No Lighthouse/axe/bundle tooling in repo | **Gap**: measure with `next build` output + browser run | — |

## Security dependencies flagged
- #3 caching must never hold credit/plan/payment state or cross-user data; clear on `SIGNED_OUT`.
- Gamma/PPT, payment, credit and RLS code is not touched by any proposal.
- Security phase 1/2 work lives in separate worktrees; this branch has not merged them.
