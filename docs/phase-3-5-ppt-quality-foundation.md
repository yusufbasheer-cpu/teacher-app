# Phase 3.5 PPT quality foundation

Status: implemented on `staging`. Phase 4 was not started. The provisional learning-objective layouts remain disabled by default.

## GitHub handoff

- Repository: https://github.com/yusufbasheer-cpu/teacher-app
- Baseline: `b8fd77ea8b997c2328cbc2e40dca6d21340822fa`
- Implementation: `b0f532725a649bed181a240a93fb3d9af2f2803b`
- Compare: https://github.com/yusufbasheer-cpu/teacher-app/compare/b8fd77ea8b997c2328cbc2e40dca6d21340822fa...b0f532725a649bed181a240a93fb3d9af2f2803b

## Implemented corrections

### Numbered-list integrity

The legacy bridge now recovers `orderedSteps` blocks from numbered text instead of flattening every body into one paragraph. It also pairs differentiation labels with their task text. Fit-driven pagination keeps list items atomic after the initial capacity pass, preserves teacher notes on the first page, and uses continuation notes on subsequent pages. Retrieval-practice rendering separates leading and trailing prose from numbered steps.

The Water Cycle benchmark now renders 13 coherent physical slides from 13 logical sections. The baseline rendered 15 slides, while the first corrected audit draft rendered 16. The implementation did not impose a global 13-slide limit; dense content can still use semantic continuation.

### Semantic quality validation

`ppt-semantic-quality.ts` adds deterministic checks for required structures: concrete starter action, observable learning outcomes, complete core teaching, three differentiation tiers, two or three exit prompts, four to six measurable success criteria, numbered SDG goal, explained connections, and actionable plenary/AfL content. Known placeholders become blocking errors. Topic-label overlap remains a warning because valid equations, source analysis, and worked examples may not repeat the topic name.

The existing three-attempt generation loop now accepts a response only when blocking semantic checks pass. No new provider or additional call path was added. Logs contain issue codes rather than lesson text. Arabic output does not run through the English verb/label lexicon, avoiding false retries; Arabic-specific semantic validation remains future work.

### Honest fallback behaviour

Six English fallback sections now identify themselves as incomplete and request regeneration rather than presenting generic prose as a finished lesson. Valid generated sections remain intact because recovery remains section-specific. The UI detects these incomplete markers, shows an actionable error, offers the existing regenerate path, and withholds the PowerPoint download until the lesson is complete.

### Diagnostics and fixtures

The non-blocking diagnostic now separates `warnings` from `errors`, flags duplicate bodies, fragmented number-only lines, generic/incomplete content, invalid structures, missing images and unexpected continuations. Fixtures cover Science (Water Cycle), Mathematics (Linear Equations), and History (Industrial Revolution).

## Visual and package verification

Microsoft PowerPoint opened and exported all three corrected PPTX files without repair prompts:

- Water Cycle: 13 physical slides
- Linear Equations: 13 physical slides
- Industrial Revolution: 13 physical slides

The artifact regression verifies native slide text, absence of detached number-only text nodes, 13 teacher-note parts for the Water Cycle sample, and valid ZIP/PPTX structure. The Water Cycle diagnostic reports no blocking errors and zero overflow risk. Local generation of the three benchmark files took about 2.7 seconds including the Vitest process and test startup; this is an operational observation, not a production latency benchmark.

## Changed files

- `src/lib/slide-deck-legacy-adapter.ts` and tests
- `src/lib/slide-layout-engine.ts` and tests
- `src/lib/ppt-template-engine.ts`
- `src/lib/ppt-semantic-quality.ts` and tests
- `src/lib/ppt-individual-slide-generator.ts`
- `src/lib/ppt-structured-lesson.ts`
- `src/lib/ppt-quality-report.ts` and tests
- `src/components/lesson-plan/teacher-package-viewer.tsx`
- `src/lib/presentation/critical-quality-review-artifacts.test.ts`
- `artifacts/critical-quality-review/` benchmark PPTX and contact sheets

## Verification results

- TypeScript: passed
- Targeted ESLint: passed with five pre-existing warnings and no errors
- Vitest: 494 passed, 4 skipped across 57 files
- Production build: passed
- PowerPoint package/editability/teacher-note assertions: passed
- Visual inspection: passed for numbered-list integrity and clipping; slide-library visual variety remains outside this phase

## Remaining quality issues

- Corrected benchmark image coverage remains 0%. Relevant imagery and diagram layouts require approved Phase 4 work.
- Most non-objective slides still use the existing generic composition family. Phase 3.5 repairs structure and content gates, not the 13-slide visual library.
- Arabic-specific semantic validators and honest Arabic fallback copy remain pending.
- Live-provider content quality was not sampled through an authenticated staging lesson-generation session.
- Google Slides and Keynote were unavailable; verification used Microsoft PowerPoint and package-level assertions.
- The diagnostic's short-title warning is expected for the minimal title slide and remains advisory.

## COPY THIS INTO CHATGPT

Review Layahh Phase 3.5 as an independent release gate. Do not assume automated tests prove visual or educational quality.

Repository: https://github.com/yusufbasheer-cpu/teacher-app

Baseline commit: `b8fd77ea8b997c2328cbc2e40dca6d21340822fa`

Implementation commit: `b0f532725a649bed181a240a93fb3d9af2f2803b`

Compare: https://github.com/yusufbasheer-cpu/teacher-app/compare/b8fd77ea8b997c2328cbc2e40dca6d21340822fa...b0f532725a649bed181a240a93fb3d9af2f2803b

Inspect these repository artifacts:

- Baseline contact sheet: https://github.com/yusufbasheer-cpu/teacher-app/blob/b8fd77ea8b997c2328cbc2e40dca6d21340822fa/artifacts/critical-quality-review/original-full-deck-contact-sheet.png
- Corrected Water Cycle contact sheet: https://github.com/yusufbasheer-cpu/teacher-app/blob/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected-full-deck-contact-sheet.png
- Corrected Water Cycle PPTX: https://github.com/yusufbasheer-cpu/teacher-app/raw/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected/water-cycle-content-benchmark.pptx
- Mathematics contact sheet: https://github.com/yusufbasheer-cpu/teacher-app/blob/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected/linear-equations-contact-sheet.png
- Mathematics PPTX: https://github.com/yusufbasheer-cpu/teacher-app/raw/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected/linear-equations-content-benchmark.pptx
- History contact sheet: https://github.com/yusufbasheer-cpu/teacher-app/blob/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected/industrial-revolution-contact-sheet.png
- History PPTX: https://github.com/yusufbasheer-cpu/teacher-app/raw/b0f532725a649bed181a240a93fb3d9af2f2803b/artifacts/critical-quality-review/corrected/industrial-revolution-content-benchmark.pptx

Assess whether numbered instructions remain coherent, continuations occur only when necessary, content is specific and assessable, teacher notes and editable text remain intact, incomplete fallbacks are handled honestly, and the visual outputs represent a meaningful improvement. Return an explicit GO or NO-GO for completing Phase 3.5. Treat image coverage, cross-application verification, live-provider sampling, and the still-limited non-objective visual library as declared remaining issues rather than silently ignoring them.
