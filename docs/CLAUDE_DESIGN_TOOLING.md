# Claude Code Design/Frontend Tooling

> Documentation-only. Explains what's installed for Claude's frontend/design work in
> this repo, and how to change it. Nothing here affects the running application.

## What's installed

**Project-local skills** (`.claude/skills/`, tracked in git — real files, not live
symlinks, since this checkout has `core.symlinks=false`; `.agents/skills/` holds the
same content as the installer's canonical source):

| Skill | Source | Purpose |
|---|---|---|
| `layah-design-system` | Hand-written for this repo | Layah-specific routing rules: component/icon/motion policy, bugfix restraint |
| `animate`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `pick-ui-library`, `prototype`, `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | Motion/animation decisions, design-engineering polish, UI-library choice, correct `sonner` usage |
| `animate-expo`, `write-swift` | same collection | Installed as part of the same bundle; inert here (no Expo/Swift code in this repo) |

**Already installed globally** (not part of this project, found during setup — no
action taken, listed for awareness):

| Skill | Covers |
|---|---|
| `vercel:shadcn` | shadcn/ui CLI, component installation, theming — Layah's `components.json` is already configured (style `base-nova`, icons `lucide`) |
| `ui-ux-pro-max` | Icon database, color palettes, GSAP motion presets, UX guidelines |
| `frontend-design` | Aesthetic direction, typography, non-templated visual choices |

**MCP servers**: none added. `.mcp.json` only has `playwright`, unchanged.

## Verified but not installed

Evaluated against their canonical source; deliberately not pulled into the project.
Consult these by hand when the specific need comes up — see the icon/motion policy in
`layah-design-system` for exactly when each applies.

| Tool | Canonical source | Why not installed |
|---|---|---|
| Hugeicons | hugeicons.com — official MCP `@hugeicons/mcp-server` | No current icon-swap need; enabling an MCP is cheap to do later (`claude mcp add --transport stdio hugeicons -- npx -y @hugeicons/mcp-server`) but not worth the always-on surface until it's actually used |
| Keyline Icons | keylineicons.com | No official Skill/MCP exists; it's a static SVG set — copy a specific icon by hand if needed |
| theSVG | thesvg.org — official MCP exists | Same reasoning as Hugeicons; enable when Layah actually needs brand/service logos |
| Morphicons | morphicons.com, npm `morphicons` | Runtime library, not a Skill/MCP — only add to `package.json` when actually building an icon-state-transition interaction |
| ibelick/ui-snippets | github.com/ibelick/ui-snippets | This is what "Belic/ui" most likely referred to (no project by that exact name exists) — no installer/registry confirmed, reference only |
| transitions.dev | transitions.dev/skill.html (3rd-party skill by Jakub Antalik) | Ships CSS `t-*` transition classes; overlaps with and doesn't match Layah's existing JS-driven `framer-motion`/`motion` stack — `animate` (from emilkowalski/skills) is the better fit here |

## Project-local vs. global

Everything installed for Layah specifically lives under this repo's `.claude/skills/`
and is committed to git, so every contributor (and every Claude session in this repo)
gets the same setup automatically. Nothing was added to the user's global `~/.claude/`.

## How to verify

```
ls .claude/skills/
cat skills-lock.json
```

Each skill folder should contain a `SKILL.md`. `skills-lock.json` is the installer's
lock file — don't hand-edit it.

## How to update

Re-run the same installer command; it will pull the latest version of the whole
collection:

```
npx skills@latest add emilkowalski/skills
```

`layah-design-system` is hand-written — edit `.claude/skills/layah-design-system/SKILL.md`
directly.

## How to disable/remove

- Remove one skill: delete its folder under both `.claude/skills/<name>/` and
  `.agents/skills/<name>/`, and its row in `skills-lock.json`.
- Remove the whole `emilkowalski/skills` collection: delete `.agents/skills/`,
  `.claude/skills/` (except `layah-design-system`), and `skills-lock.json`.
- Remove the routing rules: delete the "Frontend/design tool routing" section from
  `CLAUDE.md`.

## Adding a new design tool later

1. Verify its canonical source (official site/repo) before installing anything —
   don't trust a name alone.
2. Decide the right mechanism: Agent Skill (teaches Claude *how*), MCP (gives Claude a
   live searchable tool), application library (real `package.json` dependency), or
   just a reference link.
3. Prefer project-local installation so it's shared via git, unless it's generic
   enough that project-coupling adds no value.
4. Add one row to the routing table in `CLAUDE.md` and to the tables above — keep the
   routing intent-driven and avoid overlapping tools that cover the same job.
