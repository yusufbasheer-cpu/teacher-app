# Project Memory

## Goal

Understand and maintain the existing website built by my teammate.

## Team

- My teammate built most of the frontend
- I am working on understanding the architecture and adding features safely

## Always do first

1. Read this file
2. Read docs/architecture.md if it exists
3. Summarize your understanding before editing code

## Development workflow

- Explain the change before implementing it
- Make the smallest safe modification
- List all modified files
- Suggest how to test the change

## Things to avoid

- Do not rename routes unless necessary
- Do not delete shared components without checking dependencies
- Preserve existing APIs and props whenever possible

## Frontend/design tool routing

For any frontend or UI task, load `layah-design-system` first — it has the
project-specific rules. See `docs/CLAUDE_DESIGN_TOOLING.md` for the full picture.

| Task | Route to |
|---|---|
| Build/edit a common component | Check `src/components/**` first, then the `vercel:shadcn` skill |
| Choose a general UI icon | `lucide-react` (project default) — see icon policy in `layah-design-system` |
| Add a brand/service logo | theSVG reference (thesvg.org) — logos only, not UI icons |
| Icon changes state (play↔pause, menu↔close) | Consider `morphicons` — only when actually building that interaction |
| Animation / microinteraction | `animate` skill (from `emilkowalski/skills`) |
| Review an existing animation | `review-animations` skill |
| Polish an interaction/UI | `emil-design-eng` or `apple-design` skill |
| Choosing between UI approaches | `pick-ui-library` skill |
| Any Layah-specific UI call | `layah-design-system` |

**Do not invoke every design skill/tool for every frontend task** — use the minimum
relevant set. A simple prop/style change needs none of the above beyond checking
existing components first.
