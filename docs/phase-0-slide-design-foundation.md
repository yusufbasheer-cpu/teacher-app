# Phase 0: slide generator and frontend foundation

Date: 20 October 2026

Scope: audit and frontend foundation only. No Phase 1 layouts, layout selector, prompt limits, registry expansion, or renderer architecture replacement are included.

## Executive findings

- The Layah-native exporter uses `pptxgenjs`. Uploaded school templates use a separate Flask service built on `python-pptx` and direct OOXML repair.
- The production lesson contract is a fixed 13-role sequence. Its legacy model is deliberately small: `slideTitle`, `body`, `speakerNotes`, `includeImageSlot`, plus optional `aflCallout`. The richer `DeckSpec` schema is a validated compatibility layer, not thirteen independent input interfaces.
- Generated wording is editable. A deterministic sample contains 13 slide XML parts, 190 native text shapes and 90 text runs. Images remain raster objects, as expected.
- Teacher AfL choices are keyed by phase, sanitized against a closed catalogue, injected into assigned slides, carried into schema metadata with `provenance: "teacher-selected"`, and rendered from the selected tool IDs. Invalid, duplicate, cross-phase IDs are rejected or dropped at the API boundary.
- Overflow is handled in two native layers: legacy row-height chunking for `StructuredLessonSlideModel`, and schema-native render-to-fit pagination for `DeckSpec`. Uploaded templates have their own character/line capacity splitter. None truncates content silently.
- The recently introduced, uncommitted main-worktree flow adds protocol-v2 NDJSON events, a live slide workspace, cancellation, and direct `DeckSpec` export. Staging currently streams text progress and shows the lesson-package preview only after completion. This Phase 0 work did not copy or alter that unfinished flow.

## Architecture map

```text
Lesson composer
  -> POST /api/lesson-plan
     -> authenticate, entitlement, quota and rate checks
     -> sanitize AfL selections
     -> generate the 13 PPT bodies one slide at a time
     -> stream NDJSON progress when PPT is selected
     -> return lesson package + slide image URLs
  -> TeacherPackageViewer / ArtifactWorkspace
     -> preview generated text sections
     -> choose Layah theme or uploaded school template
     -> POST /api/lesson-plan/export/pptx
        -> buildStructuredLessonSlides (fixed 13 roles)
        -> resolve/reuse slide images
        -> Layah theme
           -> adaptLegacyDeckToDeckSpec
           -> validate DeckSpec
           -> select compositions + paginateToFit
           -> ppt-template-engine.ts / PptxGenJS
           -> pptx-repair.ts
           -> editable .pptx
        -> Uploaded school template
           -> uploaded-ppt-export.ts
           -> Flask /generate-ppt
           -> python-pptx + OOXML relationship repair
           -> editable .pptx
```

Primary code locations:

| Responsibility | Repository source |
| --- | --- |
| Generation API and NDJSON progress | `src/app/api/lesson-plan/route.ts` |
| Per-slide AI call and retry | `src/lib/ppt-individual-slide-generator.ts` |
| Slide-specific prompts and sanitizers | `src/lib/ppt-slide-by-slide.ts` |
| Fixed 13-role deck builder | `src/lib/ppt-structured-lesson.ts` |
| Versioned schema and validation | `src/lib/slide-schema.ts` |
| Legacy-to-schema bridge | `src/lib/slide-deck-legacy-adapter.ts` |
| Composition choice and continuation | `src/lib/slide-layout-engine.ts` |
| Native rendering | `src/lib/ppt-template-engine.ts` |
| PPTX export entry | `src/lib/lesson-plan-export.ts` |
| Export HTTP route | `src/app/api/lesson-plan/export/pptx/route.ts` |
| Uploaded-template client | `src/lib/uploaded-ppt-export.ts` |
| Uploaded-template service | `python-ppt-api/main.py`, `python-ppt-api/template_engine.py` |

## Exact current 13-slide inventory

Every row requires the five shared fields below. `aflCallout` is optional.

```ts
type StructuredLessonSlideModel = {
  slideTitle: string;
  body: string;
  speakerNotes: string;
  includeImageSlot: boolean;
  aflCallout?: string;
}
```

The “body contract” column records the real constraints enforced by builders and sanitizers. The current production contract does not expose proposal-style fields such as `{ objective }` or `{ criteria: string[] }` per role.

| # | Canonical role/title | Required body contract and source | Optional / conditional data | Image |
| --- | --- | --- | --- | --- |
| 1 | Subject, Grade, Date | Subject and grade title; body is grade and generated date | teacher name affects export metadata | Yes |
| 2 | Starter Activity | One isolated starter/hook activity from generated outline or lesson plan | AfL starter tools; fallback warm-up | Yes |
| 3 | Chapter, Topic and SDG Goal | Chapter/topic context and SDG connection | chapter and curriculum framework | Yes |
| 4 | Learning Objectives | Teacher-entered learning objectives, preserved verbatim and cleaned only for display | none; AI additions are explicitly prevented | No |
| 5 | Learning Outcomes | Measurable student outcomes derived from lesson content | fallback outcome | No |
| 6 | Main Phase Core Teaching | Core explanation and guided practice | AfL main-phase tools; generated teacher notes | Yes |
| 7 | Differentiated Activity and Mini Plenary | Higher, middle and lower tiers plus mini plenary; sanitizer enforces tier separation | AfL mini-plenary tools | Yes |
| 8 | UAE Real Life and Cross Curricular Connection / Real Life and Cross Curricular Connection | Real-life and cross-curricular connection | UAE title/content when a UAE framework is selected | Yes |
| 9 | Plenary | Consolidation/reflection activity | AfL plenary tools | Yes |
| 10 | Extended Task | Extended/homework task; sanitization removes success-criteria leakage | explicit homework task overrides/merges with generated content | Yes |
| 11 | Exit Ticket | Short check before leaving | AfL exit-ticket tools | Yes |
| 12 | Success Criteria and Self Evaluation | Success criteria plus pupil self-evaluation | generated fallback | Yes |
| 13 | Lesson Takeaway | Concise key idea, evidence/check, question and next step | localized Arabic copy | No |

Historical diagnostics retain per-role character/line guidance of `220/4`, `3400/22`, `1200/12`, `2200/16`, `2600/18`, `4800/26`, `3600/22`, `5000/26`, `3400/22`, `3600/22`, `1200/12`, `2600/18`, `420/6`. These are no longer truncation limits; pagination owns fit.

### Schema-native fields

The compatibility layer enriches each role into `SlideSpec`: required `id`, `order`, `title`, `pedagogicalPurpose`, `centralTakeaway` (nullable), `contentBlocks`, `layoutIntent`, and `speakerNotes`; optional `composition`, `compositionVariant`, `image`, and `afl`. Supported content blocks are paragraph, key idea, bullet list, ordered steps, worked example, diagram, comparison, task, question, and reflection. The validator checks nested required fields, stable IDs, option references, image sources, AfL provenance, deck size and total text bounds.

## AfL representation and enforcement

1. `AflSelectionsPayload` maps supported phases to arrays of tool IDs.
2. The composer uses `AFL_PHASE_GROUPS`; the API calls `sanitizeAflSelections` before prompts, entitlement checks or exports.
3. The AI prompt receives only valid selections. Slide-specific binding maps each phase to the intended role rather than letting the model choose a different activity.
4. `applyAflDeckInjections` places the selected activity in the fixed deck.
5. The schema bridge records `{ phase, selectedToolIds, provenance: "teacher-selected" }`.
6. Schema validation rejects unknown phases, IDs belonging to another phase, duplicates, empty selections, or altered provenance.
7. The renderer resolves labels from the same closed catalogue. Teacher choices therefore survive generation, conversion and rendering.

## Rendering and continuation

The native engine renders titles, body rows, images, callouts and notes as PowerPoint objects. `renderEducationalComposition` dispatches to composition functions such as concept focus, worked example, diagram, process, comparison, objective checklist, activity, hinge question, retrieval, reflection and summary.

Legacy rendering measures wrapped row heights, groups rows within the available body height, and emits physical continuation slides with continuation notes. Schema-native rendering first estimates density and selects a compatible composition. `paginateToFit` then trial-renders candidates at the minimum supported font size. It splits paragraphs, key ideas, lists, steps and task instructions semantically; it preserves structured relationships and fails explicitly when a diagram, comparison or question cannot fit safely. Uploaded templates independently inspect placeholder capacity and use `_split_body`; they fail with `TEXT_OVERFLOW` when even the continuation title or content cannot fit.

## Current versus recently introduced flow

| Current staging | Recently introduced main-worktree flow | Phase 0 decision |
| --- | --- | --- |
| NDJSON v1 progress strings and a full completion payload | Versioned events for deck, slide, image, completion, error and cancellation states | Audited only |
| Full-screen loading game during generation | Live three-pane slide generation workspace | Audited only |
| Text package preview after completion | Slide outline and visual canvas while slides arrive | Audited only |
| Export reconstructs the fixed deck from saved package text | Direct validated `DeckSpec` can travel to the exporter | Audited only |
| No client cancellation token | Abort controller and stale-generation guards | Audited only |

The newer flow is promising but still uncommitted in the separate dirty checkout. Mixing it into this deployment would exceed Phase 0 and risk overwriting unrelated work.

## Frontend UX findings

| Before | After | Why |
| --- | --- | --- |
| Indigo brand token conflicted with the approved teal/mint direction | Semantic brand ramp is teal/mint on deep navy and off-white | Aligns product UI and slide-library direction from one token source |
| Instrument Sans handled headings and body copy | Poppins headings with system-safe UI body | Establishes the requested type hierarchy without a second UI framework |
| Sidebar called the core tool “Lesson plan” | “Lesson + presentation” with an editable-PowerPoint hint | Makes the PPT capability discoverable before opening the composer |
| Dashboard hero led with generic lesson planning | Hero names the lesson and PowerPoint outcome; primary button says “Create lesson + presentation” | Clarifies the highest-value action immediately |
| Composer title and final action were lesson-only | Presentation is named in the page title, output choice and conditional primary action | Keeps hierarchy consistent through configuration |
| Buttons changed color but had limited press feedback | Shared button adds a restrained 0.97 active scale | Improves tactile feedback without decorative motion |

Existing strengths retained: semantic colors, shared Base UI primitives, one primary button hierarchy, visible focus treatment, reduced-motion support, responsive rail/drawer navigation, skeleton/loading states, accessible form labels, and the artifact download workspace.

Browser audit coverage: public staging pages and authentication were exercised at 1440×1000, 1024×768 and 390×844. Protected routes correctly redirected to login. No authenticated browser session or staging test credential exists in the repository or available browser surfaces, so dashboard, configuration, preview and download findings are source-backed and covered by automated component/unit behavior rather than fabricated browser evidence.

## Design foundation

- Colors: deep navy ink, teal primary, mint subtle states, off-white canvas, semantic danger/success/generated states.
- Typography: Poppins for headings; system UI stack for controls and body; Source Serif remains isolated to generated document previews; IBM Plex Mono remains for data.
- Spacing: reusable 4–48 px scale.
- Radius: 4, 6, 10, 14, 20 px and pill.
- Shadows: popover and overlay elevations.
- Buttons: primary, outline, subtle, ghost, secondary, danger, quiet danger and link; shared sizes and block behavior.
- Controls: shared input/select/textarea geometry, invalid and disabled states.
- Focus: global 2 px teal outline with offset plus component rings.
- Loading: route skeletons, brand loader, generation progress and live-region download status.
- Responsive breakpoints: 640, 768, 1024 and 1280 px, matching the existing Tailwind breakpoints.

## Test and performance evidence

- Existing coverage spans schema validation, legacy adaptation, layout selection, semantic continuation, composition stress, RTL/Arabic, language, image resolution, content safety, render primitives, template rendering, PPTX repair and uploaded-template handling.
- A deterministic generated sample was inspected at OOXML level: 13 slides, 190 text shapes, 90 text runs and 13 picture objects. Text is not flattened into slide images.
- The export route allows up to 180 seconds because image acquisition and external template rendering can dominate latency. Generation events record total API duration, but there is no production percentile dashboard or renderer-only benchmark in the repository. Phase 0 therefore avoids an unsupported “no slower than today” claim.
- The verification commands and final results are recorded in the delivery summary for the deployed commit.

## Phase boundary

Not implemented: new Canva-derived layouts, a new layout registry, deterministic seeded layout selection, prompt-connected slot limits, a learning-objective vertical slice, or a feature-flagged renderer rollout. Those belong to Phase 1 and later.
