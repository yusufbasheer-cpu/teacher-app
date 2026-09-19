# Frontend revamp: implementation and handoff

## Objective and branch boundary

Rebuild the frontend's layout, hierarchy and interactions across every route. This is a structural revamp, including dashboards, generator setup, output/download workflows, public pages and account/admin screens. Remove duplicate actions and dead controls, retain actual API/auth/payment behavior, and use one accessible visual and motion system.

All implementation is on `staging`. Do not merge into or deploy `main` as part of this task.

Baseline checked after `git fetch origin --prune` on 19 September 2026:

- Production baseline: `origin/main` = `285b9e66c3ba1398ee9a51047a6359d64aceef58`.
- Previous staging: `909785e3ce05792a90c549044ebedfaedd55342e`. Main is its ancestor, but dashboard/workspace.tsx differed.
- Preserved old staging at `backup/staging-before-frontend-revamp-20260919`.
- Alignment commit on staging: `ddfb94f`. Both staging and main source trees are `f3a8b357fac4d0a4dcbd42183c6ddbd25901ce2e` at this baseline.
- Untracked `.reticle*`, `artifacts/`, `backend-python/`, `supabase/.branches/` and `supabase/.temp/` are pre-existing user files; leave them alone.

## Review evidence and testing limits

Read the current route implementations, design primitives and earlier UI-flow audit. The older audit is historical and must not be treated as the current UI. Live public homepage content was opened at https://www.layah.in/ before edits. A connected browser is currently unavailable: Browser runtime `getForUrl` returns `No browser is available`. Do not claim visual, signed-in or end-to-end verification until actually performed.

Public homepage review found repeated hero text and repeated how-it-works content in the document, plus several competing generation calls to action. Source review will distinguish responsive duplicates from actual visible repetition. Authenticated API behavior must be retained. Fal image balance is empty per the user; do not confuse provider failures with frontend regressions.

## Design contract

- Direction: calm professional teaching workspace. Slate/ink typography, clean white panels on a soft blue-gray canvas, restrained indigo primary actions, muted green for success and amber for attention. Dark mode uses navy surfaces with readable contrast.
- Retain existing semantic token names (`bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `text-faint`, `border-line`, `bg-brand` etc.). Root agent owns their values. No parallel palettes in individual page families.
- Typography: Instrument Sans for controls and headings; serif only inside generated printable documents; mono only for actual numerical/technical data. Page title about 28–32px, section title 17–20px, body 14–16px. Replace tiny uppercase labels where they impede reading.
- Shared page composition: breadcrumb/context in shell; one page header with short description and primary action; purposeful sections with 24–32px separation; 1200px workspace maximum; narrower setup/reading layouts where useful. Standardize loading, error, empty and success states.
- Navigation: stable desktop workspace sidebar, clear active route, accessible mobile navigation. Public pages use one consistent public header/footer. Account menu, theme switch and search must actually work or be omitted.
- Action policy: one primary action per task. Each artifact has one download location. Download all is a separate package action only when it includes all visible outputs correctly. Do not retain blank handlers, `href="#"`, fake export counters or decorative controls that imply an available action.
- Motion: feedback/state/spatial continuity only. CSS for 140ms press/hover feedback, 180–240ms panels/dialogs. Use existing motion tokens, strong ease-out, opacity/transform, reduced-motion support and hover gating. Never delay common navigation or make users wait for staggered content.
- Keep route URLs and generation data/contracts stable. Changes to business logic require a concrete frontend bug, not aesthetic preference.

## Work packages and ownership

| Package | Files/areas | Acceptance | Status |
| --- | --- | --- | --- |
| A: foundation + shell (root) | tokens.css, globals.css, UI primitives, app frame/nav/sidebar, public navbar/footer, shared motion | coherent light/dark system, accessible controls, real mobile navigation, shared headers/layouts | In progress |
| B: teacher workspace | dashboard/workspace, lesson generators/results/saved lessons, question-paper, differentiated worksheets and their route pages | substantially reorganized dashboard/setup/output layouts; download and button audit; preserve generation/export | Pending delegation |
| C: public site | homepage/landing components; about/FAQ/contact/pricing/blog/legal route content | unified public experience, clearer story and real CTAs, working contact/pricing | Pending delegation |
| D: account + administration | auth, onboarding, settings, school registration; school/HOD/super-admin UI | consistent setup forms and dashboards, functional existing actions, responsive tables | Pending delegation |
| E: integration/QA (root) | all changed frontend | typecheck, lint, tests, production build, route/action audit, browser QA when available | Done — see Integration results |

Agents must not edit files owned by another package without coordinating. They must update their own handoff note under `docs/frontend-revamp-{teacher,public,account}.md` with changed files, behavior, validation, and remaining checks. Root updates this master checklist at integration milestones.

## Route coverage

- Public: `/`, `/landing`, `/about`, `/faq`, `/contact`, `/pricing`, `/blog`, `/blog/[slug]`, `/privacy`, `/terms`, not-found/error states.
- Teacher: `/dashboard`, `/overview`, `/lesson-plan`, `/question-paper`, `/differentiated-worksheets`, `/my-lesson-plans`, `/my-lesson-plans/[id]`.
- Account/setup: `/auth`, `/login`, `/signup`, `/onboarding`, `/settings`, `/school-register`.
- Administration: `/school-admin`, `/hod-dashboard`, `/super-admin` and all visible tabs/dialogs.

## Verification and continuation procedure

1. Read this file and the three work-package notes. Check `git status` and current branch before editing. Resume unfinished rows rather than restarting the redesign.
2. Inspect real handlers for every changed button/link. Verify submit types, pending/disabled states, error recovery, contextual downloads and navigation destinations. Leave payment/admin APIs and authentication enforcement intact.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Record exact outcomes. Existing lint warnings are not proof that newly introduced warnings are acceptable; identify additions.
4. When a browser is available, review public + signed-in teacher/account/admin pages at desktop and mobile, light/dark, keyboard focus, mobile menu, forms, saved lesson open/delete, PPT template upload, each artifact download and fallback. Use a test account for actions; don't fabricate results.
5. Keep changes on staging. Final handoff must state what is implemented, validation evidence, and any remaining browser/deployment constraints.

## Integration results (package E, 19 September 2026)

Packages A–D landed in the working tree on `staging`; nothing is committed yet. All four gates
were run against the merged result.

### Gate outcomes

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Clean. One failure found and fixed (`lesson-plan-generator.tsx`, `'user' is possibly null` in the new auto-save block). |
| Lint | `npm run lint` | 0 errors, 68 warnings, versus 85 on the baseline tree. **Zero newly introduced warnings**, verified by diffing normalized ESLint JSON against a worktree at `ddfb94f`. |
| Tests | `npm test` | 343/343 passing, 30 files. Two suites needed work — see below. |
| Build | `npm run build` | Compiles successfully; every route builds. Only pre-existing Sentry deprecation notices. |

### Defects found and fixed during integration

1. **Account data export returned nothing.** `/api/account/export` read only `lesson_plans`, but
   generated lessons have been written to `saved_lessons` since the teammate's June commit
   `b69998b`, and package B removed the last `lesson_plans` writer. Confirmed live: the export for
   the test account returned `total_lesson_plans: 0` while My Lessons showed 9. The route now reads
   both tables and maps `saved_lessons` onto the existing JSON shape, so the key and file contract
   are unchanged. Re-verified live: 0 → 9 lessons with full content. This is a data-rights feature
   sitting next to the privacy policy, which is why it was fixed rather than only logged.
2. **Two shells disagreed on scroll containment.** `AdminShell` had moved to a document-scroll +
   `sticky` sidebar while `AppFrame` kept the viewport-capped row, breaking the regression guard in
   `sidebar-scroll-containment.test.ts`. `AdminShell` is now on `AppFrame`'s pattern
   (`h-dvh overflow-hidden` row, main column owns the scrolling, `min-h-0` nav).
3. **Hero headline fused two sentences for screen readers.** The `h1` read
   "Less preparation.More teaching." — a missing space before `<br />`. Fixed and verified in the
   live DOM.
4. **Dead state removed.** `activePlanId` in the lesson generator was written but never read; the
   `?planId=` deep link it served has had no producer since `b69998b` removed those links. Removed
   the state, kept the load path working.

The containment test was updated rather than relaxed: it now accepts `h-dvh` as well as `h-screen`,
matches scroll containers regardless of attribute order (the old regex missed `AppFrame`'s real
scroll column because `ref` preceded `className`), and adds a direct assertion that the `<aside>`
is never the scroller. The export route test now models the two tables separately and pins the
merged output. Both changes tighten coverage.

### Browser verification (performed, not assumed)

A browser was available this session; the app ran locally on `http://localhost:3001`. Verified
against the signed-in test account:

- All 24 routes return the expected status (22 × 200, `/super-admin` 307 to its gate, unknown path 404).
- Zero console errors across home, dashboard, lesson-plan, my-lesson-plans and settings.
- Mobile drawer at 390 × 844: opens, labelled "Explore Layah", focus moves into it, body scroll
  locks, Escape closes it, scroll lock releases and focus returns to the trigger.
- Sidebar containment measured live: content scrolled 380px, document scroll stayed 0, the sidebar
  held at `top: 0` with height exactly one viewport.
- Sidebar rail: every icon has an `aria-label` and `title`, the active route carries
  `aria-current="page"`, and the expand toggle is present.
- Account menu opens with real destinations (`/settings`, Sign out) and moves focus into itself.
- My Lessons lists real rows with per-row labelled Open/Regenerate/Delete controls.
- Action audit across the changed UI: no `href="#"`, no empty handlers, no fake counters.

### Not verified

- Dark mode, and the school-admin/HOD/super-admin dashboards behind their PIN and role gates.
- Generation, PPT template upload and per-artifact downloads were not run end-to-end (they spend
  real generation quota and the Fal image balance is empty).
- Whether deleting an account cascades to `saved_lessons`; `/api/account/delete` calls
  `auth.admin.deleteUser` and relies on database-level cascade, which was not inspected.

## Activity log

- Baseline alignment completed and verified by identical Git tree IDs before revamp edits.
- Design engineering and animation skills selected. Browser unavailable; live public content/source review proceeding.
- Packages A–D implemented. Package E integration completed: gates green, four defects fixed,
  browser QA performed against the signed-in test account. Changes remain uncommitted on `staging`.
