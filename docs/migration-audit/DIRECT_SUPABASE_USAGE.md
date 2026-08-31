# Direct Browser Supabase Usage

Date: 2026-08-31

This inventory is limited to browser-side code paths.

## Business-Data Mutations

| Rank | Location | Mutation | Risk |
| --- | --- | --- | --- |
| 1 | `src/components/lesson-plan/lesson-plan-generator.tsx` | `lesson_plans` insert/update from the lesson generator save flow | MEDIUM |
| 2 | `src/components/lesson-plan/lesson-plan-generator.tsx` | `saved_lessons` insert during auto-save after generation | HIGH |
| 3 | `src/components/lesson-plan/lesson-view.tsx` | `saved_lessons` update/insert when saving edits from the lesson detail page | HIGH |
| 4 | `src/components/lesson-plan/my-lesson-plans-list.tsx` | `saved_lessons` delete from the lesson library | HIGH |
| 5 | `src/lib/user-usage-client.ts` | `ensure_user_usage` RPC from the browser | HIGH |

## Non-Business Browser Supabase Usage

| Location | Call | Notes |
| --- | --- | --- |
| `src/lib/active-session.ts` | `active_sessions` upsert/delete/select + `supabase.auth.getSession()` / `getUser()` / `signOut()` | session/security behavior, not business data |
| `src/components/auth/auth-card.tsx` | Supabase auth sign-in/sign-up/resend/getSession flows | auth-only; do not mix into business-data migration planning |
| `src/components/differentiated-pack/differentiated-worksheet-pack.tsx` | Supabase auth session listeners | auth/session state only |
| `src/components/dashboard/workspace.tsx` | `saved_lessons` select | read-only, not a mutation |
| `src/components/lesson-plan/my-lesson-plans-list.tsx` | `saved_lessons` select | read-only, not a mutation |
| `src/components/lesson-plan/lesson-view.tsx` | `saved_lessons` select | read-only, not a mutation |
| `src/components/dashboard/dashboard-overview.tsx` | `supabase.auth.getSession()` and selects | auth/read-only |

## Risk Classification Rationale

### LOW

No browser-side Supabase mutation currently qualifies as clearly low risk after this pass.

### MEDIUM

- `lesson_plans` save/update is the cleanest candidate for an early migration because it is localized to the lesson generator flow and has a small call surface.
- It is still user content, so it is not trivial.

### HIGH

- `saved_lessons` persistence is migration critical.
- `user_usage` and `active_sessions` are tied to quota/security behavior and should stay out of the first business-data migration pass.

## Recommendation

First migration candidate, if the detailed contract review still looks clean: `lesson_plans` save/update in `lesson-plan-generator.tsx`.

Do not start with `saved_lessons` unless later contract analysis proves it is safe enough.

## Current Status

- `lesson_plans` save/update has been moved behind `POST /api/lesson-plan/save`.
- The browser still owns `saved_lessons` auto-save, list, view, and delete flows.
