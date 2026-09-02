---
name: layah-design-system
description: Use for any frontend UI, dashboard, layout, component composition, visual consistency, icon selection, motion, responsiveness, or design-system decision inside the Layah teacher-app project. Not for backend, database, payments, or auth logic changes with no UI surface.
---

# Layah Design System

Layah is a Next.js 16 / React 19 / Tailwind 4 app. shadcn/ui is already initialized
(`components.json`: style `base-nova`, icons `lucide`, no custom registries) — treat
that config as fixed, never re-init or overwrite it.

## Component priority

1. Search `src/components/**` (grouped by feature: `lesson-plan/`, `auth/`, `hod/`,
   `school/`, `admin/`, `payment/`, `pricing/`, `usage/`, `landing/`, `ui/`, `effects/`)
   for an existing component before building anything new.
2. Reuse it, or extend it, before reaching for a new primitive.
3. If a standard primitive is missing (dialog, dropdown, table, etc.), add it via the
   shadcn CLI (`vercel:shadcn` skill / `npx shadcn add <component>`) — don't hand-roll
   what shadcn already provides.
4. Build fully custom UI only when the above genuinely don't fit.

## Icon policy

- **Default**: `lucide-react` — already the project's configured icon library. Use it
  for all general product/UI icons unless there's a concrete reason not to.
- **Hugeicons** (official MCP: `@hugeicons/mcp-server`, see hugeicons.com/docs) — not
  currently enabled in this project. Consider only if lucide is missing a needed icon
  and the visual style still matches; enable the MCP deliberately, don't assume it's on.
- **Keyline Icons** (keylineicons.com / github.com/keyline-icons/keyline-icons) —
  reference only, no MCP/skill exists. Copy an individual SVG by hand for a specific
  gap, don't bulk-import.
- **theSVG** (thesvg.org) — brand/company/service logos only (e.g. "Google" logo on a
  sign-in button), never general interface icons. Has an official MCP but it isn't
  enabled here; fetch a specific logo SVG manually when needed.
- **Morphicons** (morphicons.com, npm `morphicons`) — not installed. Only relevant for
  genuine icon **state** transitions (play↔pause, menu↔close, expand↔collapse). Add it
  as a real dependency at the point you're building that specific interaction, not
  before, and not for static icons.
- Never mix icon families on the same visual surface — pick one per screen/component
  group.

## Motion policy

`framer-motion` and `motion` are already installed. For animation decisions (easing,
duration, which properties to animate), consult the `animate` skill from the installed
`emilkowalski/skills` collection (`.claude/skills/animate/`) — it encodes the actual
reasoning, don't reinvent it. Related skills from that same collection, use as fitting:

- `animation-vocabulary` — naming/reasoning about motion types
- `find-animation-opportunities` / `improve-animations` — spotting and upgrading weak
  motion in existing UI
- `review-animations` — critiquing an animation that's already built
- `apple-design` — broader interface/motion design principles
- `pick-ui-library` — choosing between UI approaches when one is genuinely needed
- `ask-sonner` — Layah already depends on `sonner` for toasts; use this skill for
  correct Sonner usage instead of guessing the API

Ignore `animate-expo` and `write-swift` from that collection — no Expo or Swift code
exists in this repo.

Motion should clarify state, hierarchy, or feedback — not decorate. Always respect
`prefers-reduced-motion`. Avoid animating for its own sake.

## Design quality checklist

When touching UI, actively consider (without redesigning unrelated areas): spacing,
alignment, hierarchy, hover/focus/active states, loading states, empty states, error
states, responsive behavior, keyboard accessibility, and dark/light theme if the surface
supports it.

## Bugfix restraint

For a UI bug fix: fix the reported issue only. Preserve the existing visual language.
Don't opportunistically redesign the page — that's a separate, explicit request.

## Don't invoke everything

A simple style/prop change needs none of the above beyond "check existing components
first." Use the minimum relevant tool for the task — see the routing table in
`CLAUDE.md` for quick intent → tool mapping.
