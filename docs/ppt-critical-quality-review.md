# PPT critical quality review

Status: **RELEASE BLOCKED — diagnostic review complete; no Phase 3/4 authorization implied.**

Reviewed on 21 October 2026 against the three Phase 2 water-cycle artifacts. All three contain the same 13 logical slide models and the same generic fallback content. The Statement and Target files differ from the legacy file only on the learning-objective rendering path. PowerPoint exports contain 15 physical slides because the plenary and extended-task models split into continuations.

## Executive finding

The baseline decks are not production-AI samples. `src/lib/presentation/layout-selector-artifacts.test.ts` calls `buildStructuredLessonSlides` with only subject, grade, topic and one teacher objective. With no generated lesson plan or PPT outline, `src/lib/ppt-structured-lesson.ts` intentionally supplies generic safety fallbacks. The artifacts therefore prove Phase 2 selection isolation and editability, but they cannot prove production educational quality.

Production generation in `src/app/api/lesson-plan/route.ts` calls the isolated generators in `src/lib/ppt-individual-slide-generator.ts`. Those prompts explicitly request topic-specific starters, measurable outcomes, taught concepts, actionable differentiation, concrete exit questions and measurable success criteria. Production is nevertheless exposed to three real risks: weak post-generation semantic validation, generic fallback use when generated content is absent or unparseable, and the renderer's list/continuation behaviour.

## Root-cause matrix

| # | Observed issue | Actual source and affected paths | Production affected? | Proposed correction | Risk | Tests / phase |
|---|---|---|---|---|---|---|
| 1 | Weak title | The baseline title uses the single legacy title composition; no topic image is supplied. `ppt-template-engine.ts`, `ppt-image-resolver.ts`, artifact fixture. | Yes: visual sameness; system prompt currently says slide 1 has no image. | Add approved topic-aware title layouts and image eligibility without changing content. | Medium | Visual regression/contact sheet; Phase 4 layout work. |
| 2 | Generic starter | Exact fallback literal in `buildStructuredLessonSlides`; the artifact fixture supplies no generated starter. Production prompt in `generateSlide2` is specific. | Conditional: only fallback/parse failure; AI can still return weak content because validation is mostly structural. | Add semantic quality checks for observable task, topic vocabulary and student action; retain selected AFL method. | Medium | Generator contract tests and sampled live generation; Phase 3. |
| 3 | Meaningless SDG link | Exact fallback literal in `buildStructuredLessonSlides`. Production `generateSlide3` deliberately requests only goal number/title, so it also cannot provide the requested meaningful explanation. | Yes. | Extend the agreed slide-3 schema/prompt with one concise topic-to-goal explanation after schema approval. | Medium | Schema, prompt and rendering tests; Phase 3 after product approval. |
| 4 | Non-measurable outcomes | Exact fallback literal in `buildStructuredLessonSlides`. Production `generateSlide5` requests Bloom-aligned student promises, but no strong semantic gate proves measurability. | Conditional. | Validate observable verb + topic evidence + 1:1 objective alignment; retry or explicitly surface fallback. | Medium | Unit corpus plus live sampled outputs; Phase 3. |
| 5 | Core teaching describes teaching | Exact fallback literal in `buildStructuredLessonSlides`. Production `generateSlide6` explicitly requires core explanation before activity. | Conditional, not proven by these artifacts. | Reject meta-language that promises concepts without stating them; require subject vocabulary and causal explanation. | Medium | Prompt-validation corpus; Phase 3. |
| 6 | Vague differentiated tasks | Exact fallback literals in `buildStructuredLessonSlides`; production `generateSlide7` is substantially stronger and preserves teacher-selected AFL input. | Conditional. | Validate deliverable, action, scaffold and topic evidence in all three tiers. | Medium | AFL preservation and semantic tests; Phase 3. |
| 7 | Poor continuation slides | Real rendering/parser defect. Numbered source lines become separate number-only items, and semantic splitting strands list fragments. `slide-deck-legacy-adapter.ts`, `slide-layout-engine.ts`, `ppt-template-engine.ts`, `ppt-render-primitives.ts`. | Yes for sufficiently dense list content. | Keep list marker with its paragraph, split only at semantic item boundaries, and add a no-orphan invariant. | High | Dense-list PPT XML and rendered-image tests; dedicated renderer-quality fix before Phase 4. |
| 8 | Exit ticket has no questions | Exact fallback literal in `buildStructuredLessonSlides`; production `generateSlide11` explicitly asks for 2–3 questions. | Conditional. | Require 2–3 question marks or structured question items and topic concepts before acceptance. | Low–medium | Generator validation tests; Phase 3. |
| 9 | Success criteria not measurable | Exact fallback literal in `buildStructuredLessonSlides`; production `generateSlide12` requests 4–6 measurable “I can” statements. | Conditional. | Validate item count, observable verbs and evidence of success. | Low–medium | Generator validation tests; Phase 3. |
| 10 | No diagrams/visual variety | Artifact fixture supplies no image URLs; the legacy system supports images only on a fixed subset and has one composition family for most slide types. | Yes: coverage varies with resolver success, and layout variety remains limited. | Define subject-relevant visual requirements; use licensed/retrieved images plus native editable diagrams, then approved layouts. | Medium–high | Image relevance/coverage and visual QA; Phase 4, with Phase 3 content metadata preparation. |

## Safe changes made in this review

- Extended the existing non-blocking `computeDeckQualityReport` diagnostic to flag seven known generic fallback phrases. It remains explicitly outside export/render behaviour.
- Added regression coverage proving that the Phase 2 fallback fixture triggers those warnings.
- Added a fixed, schema-valid water-cycle benchmark artifact with specific explanations, student actions, questions and measurable criteria. It intentionally uses the existing renderer unchanged, exposing rather than concealing the continuation/list defect.
- No prompt, schema, API, layout selector, feature flag, renderer architecture or teacher-selected AFL behaviour was changed.

## Fixed benchmark requirements

A representative release candidate deck must pass human review and meet every condition below:

1. Every teaching slide contains named subject concepts and at least one accurate causal explanation, example or worked application.
2. Starter, guided, differentiated and plenary activities state student action, evidence/output, timing where relevant, and the concept being assessed.
3. Outcomes and success criteria use observable verbs and state what acceptable evidence looks like.
4. Exit ticket contains 2–3 actual questions progressing from recall/explanation to application.
5. SDG/real-life links name the connection and explain why it is relevant to the topic.
6. The deck contains at least one relevant explanatory visual or editable diagram for every concept that materially benefits from one; decorative imagery does not satisfy this requirement.
7. All 13 logical sections are complete. No educational content is truncated, paraphrased away or replaced by a placeholder.
8. Lists remain intact: no number-only rows, orphaned labels, mid-item continuation, duplicate content or continuation containing only one short stranded item.
9. Composition is consistent and professional while providing meaningful visual variety; projection-size text, contrast and margins pass visual inspection at 16:9.
10. Dynamic text and native diagrams remain editable. The PPTX opens without repair prompts and downloads through the existing workflow.
11. Automated checks are necessary but insufficient: the rendered full-deck contact sheet must receive explicit human approval.

## Original versus corrected benchmark

The corrected benchmark demonstrates materially better educational specificity: it teaches particle-level evaporation/condensation, supplies actionable differentiated tasks, gives three assessment questions and measurable criteria. It also proves that content improvement alone does not solve presentation quality. The existing renderer turns several numbered instructions into detached number rows and creates three continuation slides (16 physical slides from 13 logical sections). It still has no topic visual assets and the title remains generic. Therefore this review is **NO-GO for release** and is not a Phase 3/4 approval.

## Remaining blockers

- Fix list parsing and semantic continuation boundaries; add no-orphan rendered regression tests.
- Approve a schema-compatible SDG explanation field or an agreed concise representation.
- Add semantic acceptance validators and production sampling for AI content; prompts alone are not evidence.
- Establish relevant image/diagram metadata and approved layouts for non-objective slide types.
- Run authenticated end-to-end staging generation with the live provider and inspect the resulting contact sheet. The repository artifacts alone cannot establish current provider quality.
- Validate in Google Slides and Keynote when those applications are available; this review verified opening/export in Microsoft PowerPoint only.

