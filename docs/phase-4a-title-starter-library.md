# Layahh Phase 4A - Title and Starter Design Library

Status: **PROVISIONAL - AWAITING VISUAL APPROVAL**

Production release: **NO-GO**. The existing design-library feature flag remains disabled by default.

## Scope and baseline

- Repository: https://github.com/yusufbasheer-cpu/teacher-app
- Baseline: `74a97841cbd66cf6c68cdd2dd3a33ffda3cafb27`
- Implementation commit: `c9a172d87b6a5d9f92f3638eda5f76fcebe542ac`
- Scope: Title and Starter slides only. The approved learning-objective layouts and the other ten slide roles were not redesigned.

No approved Canva reference screenshots, text-free background PNGs, or slot specifications were available in the repository or supplied asset folder. The four Phase 4A layouts are therefore provisional coded prototypes under the proposal's missing-asset exception.

## Registry definitions

| Layout ID | Slide type | Family | Eligibility |
| --- | --- | --- | --- |
| `title_hero_01` | Title | Hero | Topic, subject and grade fit; a successfully resolved topic image is present |
| `title_typography_01` | Title | Typography | Topic, subject and grade fit; complete fallback when no image is present |
| `starter_visual_prompt_01` | Starter | Visual prompt | Starter is classified as a picture prompt, an image is present, and the body fits |
| `starter_activity_brief_01` | Starter | Activity brief | Any supported starter activity whose complete body fits |

All dynamic text remains native PowerPoint text. Images are embedded separately. Layout definitions contain the layout ID, slide type, family, named slots, content limits, fit validation and render function. The existing deterministic seed machinery remains in use. Content-based rules narrow the eligible set before deterministic selection: hero beats typography when an image is available, and a visual prompt is used only for a picture-prompt starter with an image.

The teacher's selected starter tool IDs are read only for activity classification. The renderer displays the complete generated starter body and does not substitute or rewrite the activity.

## Safety and compatibility

- PptxGenJS remains the rendering engine.
- The existing `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED` feature flag controls Phase 4A; its default remains off.
- Public generation API contracts are unchanged. The explicit layout override is internal and exists for tests and review artifacts.
- Unavailable or incompatible layouts fall back to the legacy renderer.
- RTL decks remain on the legacy title and starter renderer until the provisional compositions receive Arabic visual validation.
- Speaker notes remain attached to every physical slide.
- Phase 3.5 semantic pagination and numbered-list paths were not changed.

## Benchmark artifacts

The repository includes complete 13-slide Science, Mathematics and History decks in three forms: legacy, Phase 4A hero/visual-prompt, and typography/activity fallback. The Phase 4A benchmark images came from the existing Pexels source configured by the product and were embedded into the PPTX files. No paid source or extra AI call was introduced.

Artifact root: `artifacts/phase4a-title-starter/`

- Water Cycle: `water-cycle-phase4a.pptx`, `water-cycle-legacy.pptx`, `water-cycle-typography-activity.pptx`
- Mathematics: `linear-equations-phase4a.pptx`, `linear-equations-legacy.pptx`, `linear-equations-typography-activity.pptx`
- History: `industrial-revolution-phase4a.pptx`, `industrial-revolution-legacy.pptx`, `industrial-revolution-typography-activity.pptx`
- Full-deck contact sheets: `contact-sheets/*-phase4a-contact-sheet.png` and `contact-sheets/*-legacy-contact-sheet.png`
- Direct comparisons: `contact-sheets/*-before-after.png`
- Six-layout comparison: `contact-sheets/water-cycle-layout-variant-comparison.png`

Microsoft PowerPoint opened and exported every benchmark deck without repair prompts. Package assertions found 13 slides and 13 note parts in each deck. The full-deck contact sheets were inspected, not only slides 1 and 2.

## Verification

- TypeScript: passed
- ESLint: passed with 73 existing warnings and no errors
- Vitest: 500 passed, 5 skipped across 59 files
- Production build: passed
- Phase 4A targeted tests: 6 passed
- Benchmark artifact generation: passed
- PowerPoint export: passed for all nine PPTX files
- Editable content: validated through native OOXML text assertions
- Speaker notes: 13 note parts per benchmark deck
- Detached numbered markers: none found in benchmark XML
- Visual review: no clipping or overlap observed in the three full-deck contact sheets

## Exact changed source and support files

- `src/lib/ppt-layouts/title-starter-provisional.ts`
- `src/lib/ppt-template-engine.ts`
- `src/lib/presentation/layout-registry.ts`
- `src/lib/presentation/layout-selector.ts`
- `src/lib/presentation/quality-checks.ts`
- `src/lib/presentation/layout-registry.test.ts`
- `src/lib/presentation/phase4a-layouts.test.ts`
- `src/lib/presentation/phase4a-artifacts.test.ts`
- `scripts/render-phase4a-pptx.ps1`
- `scripts/create-phase4a-contact-sheets.mjs`
- `artifacts/phase4a-title-starter/**`
- `docs/phase-4a-title-starter-library.md`

## Remaining limitations

- The layouts are provisional because approved Canva handoff assets are missing. They require explicit visual approval before controlled rollout.
- Arabic uses the unchanged legacy renderer for these two slide roles pending RTL-specific design review.
- Poppins cannot be embedded by PptxGenJS. PowerPoint used the installed font for review; Arial is the body fallback.
- Pexels search relevance is useful but imperfect. The renderer remains complete and readable when no image resolves.
- Mathematics and History fixtures retain some intentionally generic Phase 3.5 benchmark content outside Title and Starter. This phase does not conceal or rewrite those content weaknesses.
- Google Slides and Keynote were not available for this Windows validation pass.
- The feature remains disabled for ordinary users, so production behaviour is unchanged.

## Deployment

The implementation is intended for the existing staging pipeline only. Production enablement is prohibited. Final push SHA, compare URL and observed staging deployment status are supplied in the review handoff after the artifact commit is pushed.

