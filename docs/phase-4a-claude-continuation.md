# Claude continuation handoff: Phase 4A

## Current boundary

Phase 4A implements only the Title and Starter slide design library. Stop here unless Yusuf explicitly approves Phase 4B.

The four layouts are provisional because the approved Canva screenshots, text-free background exports and slot specifications were not available. Do not describe them as approved designs and do not enable them for production users.

## Repository state

- Repository: `https://github.com/yusufbasheer-cpu/teacher-app`
- Staging baseline: `74a97841cbd66cf6c68cdd2dd3a33ffda3cafb27`
- Working branch used for implementation: `phase4a-title-starter`
- Review range after the handoff commit is pushed: `74a97841cbd66cf6c68cdd2dd3a33ffda3cafb27..origin/staging`
- Primary implementation commit: `c9a172d87b6a5d9f92f3638eda5f76fcebe542ac`
- Artifact/documentation commit: `196e34daa6c80897e58e26e429eff2f3c9402df8`

Always run `git fetch origin` and record `git rev-parse origin/staging` before continuing. Do not work from the dirty `C:\Liyaah\teacher-app` main checkout. Use a clean staging worktree.

## What Phase 4A added

- `title_hero_01`: image-led Title layout.
- `title_typography_01`: complete typography-only Title fallback.
- `starter_visual_prompt_01`: visual-prompt Starter layout when the selected activity and resolved image qualify.
- `starter_activity_brief_01`: text-led Starter layout for other supported activities.

The implementation uses the existing code-versioned registry, deterministic selector and PptxGenJS renderer. All dynamic text remains native and editable. Speaker notes and the teacher-selected starter content are preserved. Unsupported, disabled, ineligible and RTL cases return to the legacy renderer.

## Feature flag and production safety

The existing `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED` flag gates the Phase 4A layouts and defaults to disabled. The explicit `phase4aLayout` override is internal test/review plumbing only. Do not expose it through public APIs.

Production release remains NO-GO until approved Canva assets arrive, the provisional layouts receive visual approval, and RTL gets a dedicated review. Do not add paid services or extra AI/image-generation calls.

## Where to review

- Implementation and review record: `docs/phase-4a-title-starter-library.md`
- Layout definitions: `src/lib/ppt-layouts/title-starter-provisional.ts`
- Registry and selector: `src/lib/presentation/layout-registry.ts`, `src/lib/presentation/layout-selector.ts`
- Renderer integration: `src/lib/ppt-template-engine.ts`
- Regression tests: `src/lib/presentation/phase4a-layouts.test.ts`
- Artifact assertions: `src/lib/presentation/phase4a-artifacts.test.ts`
- Complete benchmark decks and screenshots: `artifacts/phase4a-title-starter/`

## Required continuation checks

1. Confirm staging still contains the exact Phase 4A commit range and the feature flag remains off by default.
2. Run `npm run typecheck`, `npm test`, `npm run lint` and `npm run build`.
3. Regenerate Science, Mathematics and History benchmark decks if renderer or content code changed.
4. Open every PPTX in Microsoft PowerPoint and confirm there is no repair prompt.
5. Inspect every slide at full size, then inspect the full-deck contact sheets and before/after comparisons.
6. Re-run the OOXML assertions for editable text, notes and numbered-list integrity.
7. Record deployment status as verified only after observing the staging deployment and smoke-testing it. Provider acceptance alone is insufficient.

## Known limitations to keep visible

- The layouts are provisional, not Canva-approved.
- RTL Title and Starter slides intentionally use the legacy renderer.
- Pexels relevance varies; every layout must remain readable without imagery.
- Mathematics and History benchmark decks retain generic Phase 3.5 content outside the Phase 4A slide types.
- Google Slides and Keynote were not part of the Windows validation pass.

If approved Canva assets arrive, replace only the provisional visual treatment while preserving layout IDs, slot contracts, deterministic selection, editable text, notes, fallback behavior and the feature flag. That approval work is still Phase 4A refinement. Do not begin Phase 4B automatically.
