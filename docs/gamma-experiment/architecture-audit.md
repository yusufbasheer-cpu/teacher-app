# Gamma experiment — PPT architecture audit

Baseline: `origin/main` @ `dc955af` (branch `experiment/gamma-ppt-integration`, rebased from `origin/staging`
@ `c399da7` at the owner's request). The first draft of this audit described staging; sections marked
**[staging only]** do not exist on `main` and were verified absent there.
Every statement below was checked against the code on `origin/main` unless marked otherwise. Where an earlier doc
(`docs/ppt-flow-audit.md`) disagrees with the code, the code wins and the difference is noted.

## Headline findings

1. **The deck is 13 slides, not ~20.** `STRUCTURED_LESSON_DECK_SLIDE_COUNT = 13`
   (`src/lib/ppt-structured-lesson.ts:28`). "20 slides" in the brief does not match the product.
   Overflow pagination can add physical slides in the legacy renderer; Gamma gets exactly 13 cards.
   All cost estimates in `cost-estimate.md` use 13 and show a 20-slide scaling line.
2. **DeepSeek is called per slide, in the lesson-plan route**, not at export time. Slides 2, 3, 5–12 each
   have an isolated `deepseek-chat` call (`ppt-individual-slide-generator.ts`); slides 1, 4, 13 are
   programmatic. The export route makes **no** DeepSeek call. So Gamma can reuse content with zero extra
   DeepSeek spend.
3. **The seam is `buildStructuredLessonSlides()` → `StructuredLessonSlideModel[13]`**
   (`{slideTitle, body, speakerNotes, aflCallout?, includeImageSlot}`), built deterministically inside the
   export route (`src/app/api/lesson-plan/export/pptx/route.ts`). Everything after it is presentation.
4. **Nothing is persisted.** The export route streams the PPTX bytes in the response (`Cache-Control:
   no-store`). There is no Storage bucket or DB row for generated decks (only the lesson JSON incl. image
   URLs is saved client-side). "Existing storage conventions" therefore = stream back. Gamma mode follows this.
5. **The Phase 3/3.5/4A layout work is NOT on `main`.** `src/lib/presentation/*` (slide-role registry, deterministic
   selector, content budgets), `src/lib/ppt-layouts/*` (`lo_statement_01`, `lo_target_01`), `slide-schema.ts`,
   `slide-deck-legacy-adapter.ts`, `slide-layout-engine.ts` and the flag `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED`
   exist only on `origin/staging`. On `main`, `buildPptxFromPptContent` feeds `StructuredLessonSlideModel[]` straight into
   the pptxgenjs engine. The Gamma code depends on none of this, so it works on either base.
6. **Gamma cannot control accent-image count or placement via the API** (docs: "Accent images cannot be
   controlled through the API"). The 10–15 image target can only be influenced (image source/model/style),
   and must be measured from the output.

## A. Existing pipeline

```
Teacher form (lesson-plan-generator.tsx)
  └─ POST /api/lesson-plan                       src/app/api/lesson-plan/route.ts
       ├─ system prompt                          src/lib/deepseek-lesson-system-prompt.ts
       ├─ DeepSeek "deepseek-chat": lesson sections (route.ts:511/560)
       ├─ "PPT Slide Content": generatePptSlideContentSlideBySlide()  (route.ts:294)
       │    13 isolated generators                src/lib/ppt-individual-slide-generator.ts (DeepSeek, :164)
       │    assembleFullPptFromSlideBodies()      src/lib/ppt-slide-by-slide.ts
       └─ generatePptDeckSlideImages()           src/lib/ppt-image-resolver.ts  (fal.ai Flux / Pexels)
            → response: lesson sections + pptSlideImageUrls[13]
  client keeps result; saves lesson_content JSON to Supabase (lesson-plan-generator.tsx:794)

Download click (teacher-package-viewer.tsx  onDownloadPpt → runExport)
  └─ POST /api/lesson-plan/export/pptx           src/app/api/lesson-plan/export/pptx/route.ts
       ├─ authenticateRequest + rate limit (20/h/IP)
       ├─ buildStructuredLessonSlides(ctx)       src/lib/ppt-structured-lesson.ts:1172  ← CONTENT/RENDER BOUNDARY
       ├─ images: client-supplied pptSlideImageUrls, else generatePptDeckSlideImages()
       ├─ templateMode "uploaded" → renderUploadedPpt (python-ppt-api)
       └─ buildPptxFromPptContent()              src/lib/lesson-plan-export.ts:1000
            └─ buildPptxFromTemplateEngine()      src/lib/ppt-template-engine.ts (pptxgenjs)
                 [staging only: adaptStructuredLessonSlidesToDeck → DeckSpec → composition engine →
                  layout-selector (flag-gated); absent on main]
  → Buffer streamed as application/vnd.openxmlformats-officedocument.presentationml.presentation
  → client blob download
```

Content/render boundary: **`StructuredLessonSlideModel[]`** (on staging also the derived `DeckSpec`). The renderer
reads but does not rewrite these fields, except `moveTeacherFacingLinesToNotes` used for uploaded templates
and the legacy engine's overflow pagination / body-limit clamps, which *do* shorten or split text at render
time (see D).

### Answers to the brief's §1.4 checklist

| Question | Answer |
|---|---|
| Which function invokes DeepSeek | `generateSlideN` in `ppt-individual-slide-generator.ts` (per slide) and the section loop in `lesson-plan/route.ts` |
| Prompts | `deepseek-lesson-system-prompt.ts`, per-slide prompts in `ppt-individual-slide-generator.ts`, `afl-tools.ts`, `curriculum-framework.ts` |
| Intermediate schema | `StructuredLessonSlideModel` on main; staging adds `DeckSpec` (`slide-schema.ts`, typed blocks) |
| Slide count | 13 fixed; titles in `STRUCTURED_LESSON_SLIDE_TITLES_EN/AR`; slide 8 title varies by framework |
| Dedicated fields for objectives/examples/questions/AFL | Only by *slide position* and, in `DeckSpec`, inferred `pedagogicalPurpose` + blocks. Legacy model has just title/body/notes/aflCallout; no distinct question/answer fields |
| Transformed before rendering | Yes: `buildStructuredLessonSlides` extracts, dedupes, strips forward refs, clamps (`SLIDE_BODY_LIMIT`) |
| Image prompts at content time | Not in DeepSeek output; `fal-ppt-slide-images.ts` builds prompts from slide text after generation |
| Renderer modifies text | Yes (pagination "Continued" slides, length clamps) |
| Reusable without a new DeepSeek call | Yes — the export route rebuilds the deck from stored text deterministically |

## B. File inventory

| File | Responsibility | Gamma affects? | Must stay unchanged? |
|---|---|---|---|
| `src/app/api/lesson-plan/route.ts` | DeepSeek lesson + per-slide generation, image pre-gen | No | **Yes** |
| `src/lib/deepseek-lesson-system-prompt.ts` | System prompt | No | **Yes** |
| `src/lib/ppt-individual-slide-generator.ts`, `ppt-slide-by-slide.ts` | Per-slide DeepSeek prompts / assembly | No | **Yes** |
| `src/lib/ppt-structured-lesson.ts` | Deterministic 13-slide builder (the seam) | Read-only input to Gamma | **Yes** |
| `src/lib/afl-tools.ts`, `curriculum-framework.ts`, `ppt-language.ts` | AFL / framework / language inputs | No | **Yes** |
| `src/app/api/lesson-plan/export/pptx/route.ts` | Export endpoint | **Yes: provider branch added** | Behaviour for legacy unchanged |
| `src/lib/lesson-plan-export.ts` | `buildPptxFromPptContent` wrapper | No | Yes |
| `src/lib/ppt-template-engine.ts`, `ppt-render-primitives.ts`, `ppt-themes.ts`, `ppt-template-config.ts`, `ppt-templates/*.json` | pptxgenjs renderer + themes | No (legacy only) | **Yes** |
| **[staging only]** `slide-schema.ts`, `slide-deck-legacy-adapter.ts`, `slide-composition-registry.ts`, `slide-layout-engine.ts` | DeckSpec schema, adapter, composition engine | No | n/a on main |
| **[staging only]** `src/lib/presentation/*` | Slide-role registry, deterministic selector, budgets | No | n/a on main |
| **[staging only]** `src/lib/ppt-layouts/*` | `lo_statement_01`, `lo_target_01`, title/starter layouts | No | n/a on main |
| `src/lib/ppt-image-resolver.ts`, `fal-ppt-slide-images.ts`, `fal-flux-section-images.ts`, `pexels-images.ts` | Image sourcing | Skipped in Gamma mode | **Yes** |
| `src/lib/pptx-repair.ts`, `ppt-quality-report.ts`, `ppt-semantic-quality.ts`, `ppt-slide-validation.ts` | Legacy structural/quality checks | No | Yes |
| `src/lib/uploaded-ppt-export.ts`, `python-ppt-api/` | Uploaded school templates | No (Gamma ignores uploaded mode) | Yes |
| `src/lib/user-usage-server.ts` (`authenticateRequest`) | Auth | Reused | Yes |
| `src/components/lesson-plan/teacher-package-viewer.tsx` | Download buttons, `runExport` | **Yes: tester-only provider toggle** | Existing behaviour preserved |
| `.env.example` | Env docs | **Yes: placeholders** | additive |
| `src/lib/gamma/*` (new) | Gamma provider | new | n/a |

## C. External integrations

| Service | Purpose | Called from | Needed in Gamma mode | Needed in legacy |
|---|---|---|---|---|
| DeepSeek | Lesson + per-slide content | lesson-plan route, slide generators | Yes (upstream, already run) | Yes |
| fal.ai (Flux) | Slide illustrations | `ppt-image-resolver.ts`, lesson-plan route | **No** (skipped) | Yes |
| Pexels | Stock-photo fallback | `pexels-images.ts` | **No** | Yes |
| Supabase | Auth, usage, saved lessons | many | Auth yes | Yes |
| python-ppt-api | Uploaded-template rendering | export route | No | Only for uploaded mode |
| Gamma | Layout, imagery, PPTX export | `src/lib/gamma/*` | **Yes** | No |

Caveat: the lesson-plan route pre-generates fal/Pexels images at lesson-creation time, before the user picks a
renderer. Those costs are already spent by the time Gamma is chosen at download. Avoiding them requires changing
the lesson-plan route, which this experiment deliberately does not do.

## D. Existing design limitations (evidence-based)

- **Fixed pagination/clamps rewrite content at render time**: `SLIDE_BODY_LIMIT` in `ppt-structured-lesson.ts`
  and character-count pagination into "Continued" slides in the engine (estimates, not measured text; also noted
  in `docs/ppt-flow-audit.md` §3).
- **On main there is no layout selection by slide role**: the engine picks styling from a fixed per-index slide-kind map
  (`SLIDE_KIND_BY_INDEX`), so slides of the same kind look alike. The role registry that addresses this
  (`DESIGN_LIBRARY_SLIDE_TYPES`, title/starter/learning-objective only) is staging-only and flag-gated.
- **Image reliability**: two providers, fal-required slots render without an image when fal fails
  (`FAL_REQUIRED_DECK_INDICES = [1,6,7,9]`).
- **Content lacks typed fields at the source**: questions/answers/examples are free text in `body`, which limits what
  any renderer (legacy or Gamma) can do semantically and means preservation checks must be text-based.

No claims here are speculative; none of these prove the legacy output is "bad", only where its ceiling comes from.

## E. Gamma integration plan (minimum change)

- New isolated module `src/lib/gamma/` (config, payload, client, validate, budget, render).
- One branch in the export route (main's route has no `PptContentError` handling; none was added; it also gained a small `GET` availability handler), after `buildStructuredLessonSlides()` and **before** any image generation:
  if the resolved provider is `gamma`, call `renderPptxWithGamma(deck)` and return its buffer; else fall through unchanged.
- Provider resolution (revised after code review; see `review-remediation.md`): a fail-closed server gate
  (`GAMMA_EXPERIMENT_ENABLED`, explicit `GAMMA_ENVIRONMENT_NAME` in `GAMMA_ALLOWED_ENVIRONMENTS`, never production,
  caller email in `GAMMA_TESTER_EMAILS`). The client's `pptProvider` only selects among what the gate allows; `PPT_GENERATION_PROVIDER`
  is a server default for authorised testers. Anything else resolves to `legacy`.
- Persistence: a `gamma_generations` ledger (migration `20261022120000`) records every paid generation, enforces one active
  generation per user, and makes timeouts resumable instead of re-billable.
- Frontend: the toggle is shown only if `GET /api/lesson-plan/export/pptx` reports Gamma as available; Gamma downloads are held behind a
  validation panel. The server remains the authority.
- Legacy code paths: zero lines changed.
