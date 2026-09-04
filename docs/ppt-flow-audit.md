# PPT flow audit — pedagogical flow freeze + visual-layer boundary

**Status note before the audit itself:** this document was requested as a "Step 1, before any visual
changes" audit. In this codebase, the visual-layer work it describes as upcoming has already been
done, on `feature/gamma-style-ppt-generation` (branched off `staging`, 3 commits: a Gamma-style
template rendering system, an image-stretch/sparse-content fix, and a Fal-AI-primary image-sourcing
change). So this doc serves as **after-the-fact verification** that the locked flow held, plus the
forward-looking audit for whatever comes next. The `git checkout main && git pull` step in the
original Step 1 prompt was skipped deliberately — resetting to `main` would abandon that already-
completed, already-tested work; see [[project-layah-changelog]] session notes for why `staging` (not
`main`) is this branch's base.

**Verified**: `git diff staging...HEAD --stat` on every content-generation file (`ppt-structured-lesson.ts`,
`ppt-slide-by-slide.ts`, `afl-tools.ts`, `curriculum-framework.ts`, both `lesson-plan` API routes) —
zero lines changed. The 3 commits touch only `src/lib/ppt-template-engine.ts`,
`src/lib/ppt-render-primitives.ts` (new), `src/lib/ppt-template-config.ts`, the 5 theme JSON files,
and `src/lib/ppt-image-resolver.ts`. Slide text, titles, order, and count are byte-identical to
`staging`.

---

## 1. Current PPT architecture

### Backend flow

- **Lesson planning** — `src/app/api/lesson-plan/route.ts`. Calls the DeepSeek API
  (`deepseek-chat`, `https://api.deepseek.com/chat/completions`) with a system prompt built in
  `src/lib/deepseek-lesson-system-prompt.ts`, using teacher inputs (subject, grade, topic,
  curriculum framework, AFL tool selections, etc.). Produces a `LessonPlanResult` — a free-text
  lesson plan plus a separate PPT-outline text block — persisted with the lesson. This same route
  also pre-generates the deck's images at creation time (`generatePptDeckSlideImages`, see below)
  so export/download doesn't re-fetch them.
- **Slide-deck construction** — `src/lib/ppt-structured-lesson.ts`, `buildStructuredLessonSlides()`.
  Deterministic (no AI call here) — parses the free-text lesson plan / PPT outline with heading
  heuristics (`extractByHints`/`findHeadingLine`) into a **fixed 13-slide array**
  (`StructuredLessonSlideModel[]`: `{ slideTitle, body, speakerNotes, aflCallout?, includeImageSlot }`),
  applies AFL-tool injection, isolation/dedup rules (strip forward references, cross-slide leakage),
  and per-slide length clamps. This is the file that owns "what the teacher sees" — untouched by
  the visual work.
- **Image sourcing** — `src/lib/ppt-image-resolver.ts` → `generatePptDeckSlideImages()`. Resolves
  one image URL per image-bearing slide (10 of 13). As of this session: Fal AI (Flux,
  `fal-ai/flux-1/dev`) is primary for all 10, Pexels is a fallback for the 5 slides that have a
  photo-search query. Resolved in parallel (`Promise.all`) — see visual issues below for why.
- **Rendering** — `src/lib/ppt-template-engine.ts` → `buildPptxFromTemplateEngine()`. Pure
  presentation layer: takes the structured slide array + resolved image URLs + a theme id, and
  produces a `.pptx` `Buffer` via **pptxgenjs** (`^3.x`, `import PptxGenJS from "pptxgenjs"`) —
  not python-pptx, not Google Slides API. Splits any slide whose body doesn't fit into a
  "Continued" overflow slide (pagination is character/line-based, computed before rendering).
- **API endpoint** — `src/app/api/lesson-plan/export/pptx/route.ts` (`POST`). Thin: validates
  input, calls `buildStructuredLessonSlides()` (or accepts a pre-built `structuredSlides` array),
  resolves images (or accepts pre-fetched `pptSlideImageUrls`), calls `buildPptxFromPptContent()`
  (`src/lib/lesson-plan-export.ts`, a thin wrapper) which delegates to the renderer above, and
  streams back the `.pptx`.
- **Theme selection** — `src/lib/ppt-template-config.ts` + `src/lib/ppt-templates/*.json` (5
  themes: classic/modern/warm/dark/minimal). This is the existing dropdown in the app UI — untouched
  by this session's work; the JSON files only gained an additive `design` token block (radius,
  shadow, card/chip colors) that the renderer now reads for styling.

### Data flow

```
Teacher inputs (subject, grade, topic, curriculum framework, AFL selections, learning objectives, homework)
        │
        ▼
DeepSeek API call (src/app/api/lesson-plan/route.ts)
        │
        ▼
LessonPlanResult { "Full Lesson Plan": string, ppt outline text, "Homework Task": string, ... }
        │
        ▼
buildStructuredLessonSlides(ctx)  — src/lib/ppt-structured-lesson.ts
        │
        ▼
StructuredLessonSlideModel[13]  — [{ slideTitle, body, speakerNotes, includeImageSlot }, ...]
        │                              (this array is the "locked content" — see §4)
        ├── generatePptDeckSlideImages() → (string | null)[13]   (image URLs, 10 of 13 populated)
        ▼
buildPptxFromTemplateEngine({ templateId, slides, subject, grade, topic, slideImageUrls, ... })
   — src/lib/ppt-template-engine.ts (pptxgenjs)
        │
        ▼
.pptx Buffer
```

---

## 2. Slide-by-slide mapping to the locked flow

**Correction to the requested 14-item locked list**: the real deck has **13 slides, not 14** —
`STRUCTURED_LESSON_SLIDE_TITLES_EN` in `ppt-structured-lesson.ts` already combines the requested
items #7 ("Differentiated Activity") and #8 ("Mini Plenary / Quick Check") into **one slide**,
titled "Differentiated Activity and Mini Plenary" (index 6), with the mini-plenary question
appended to the end of that slide's body. This has been true since before this session — it's the
existing teacher-authored structure, not something the visual work changed. Flagging it explicitly
so no future step "fixes" this by silently splitting it into two slides, which would be a real
structural change requiring sign-off, not a visual one.

| # | Deck index | Current title (EN) | Requested locked section | Status |
|---|---|---|---|---|
| 1 | 0 | `{Subject}, {Grade}` (e.g. "EVS, Grade 3") | Cover / Lesson Intro | OK |
| 2 | 1 | Starter Activity | Starter Activity | OK |
| 3 | 2 | Chapter, Topic and SDG Goal | Chapter, Topic and SDG Goal | OK |
| 4 | 3 | Learning Objectives | Learning Objectives | OK |
| 5 | 4 | Learning Outcomes | Learning Outcomes | OK |
| 6 | 5 | Main Phase Core Teaching | Main Phase / Core Teaching | OK |
| 7 | 6 | Differentiated Activity and Mini Plenary | Differentiated Activity **+** Mini Plenary / Quick Check | **Merged** — one slide covers both requested sections (pre-existing, not from this session) |
| 8 | 7 | "UAE Real Life and Cross Curricular Connection" (UAE framework selected) or "Real Life and Cross Curricular Connection" (otherwise) | Real-Life & Cross-Curricular Connection | OK — title is dynamic based on curriculum framework, content stays one connection type |
| 9 | 8 | Plenary | Plenary / Reflection | OK |
| 10 | 9 | Extended Task | Extended Task / Homework | OK |
| 11 | 10 | Exit Ticket | Exit Ticket | OK |
| 12 | 11 | Success Criteria and Self Evaluation | Success Criteria & Self Evaluation | OK |
| 13 | 12 | Thank You | Thank You / Closing | OK |

Arabic titles exist in parallel (`STRUCTURED_LESSON_SLIDE_TITLES_AR`) for Arabic-medium subjects,
same order, same mapping.

---

## 3. Visual issues discovered (this session)

Found and **fixed** on `feature/gamma-style-ppt-generation`:

- **Every content slide used one identical layout** — dense wrapped-paragraph textbox, flat
  bordered image rectangle, bare emoji as the only iconography — regardless of slide type. Fixed
  with a `SLIDE_KIND_BY_INDEX` map (hero / checklist / activity / standard) driving distinct card
  styling, bullet markers (checkmark / dot / accent square), and section chips per slide type.
- **Images stretched/distorted.** pptxgenjs's own `sizing: {type:"cover"}` looked like the fix but
  is dead code in the installed version (its natural-image-size lookup is commented out upstream —
  confirmed by inspecting the emitted OOXML, `srcRect` always came out `0/0/0/0`). Fixed by reading
  real width/height from the downloaded image bytes (PNG/JPEG/WEBP header parser, no new
  dependency) and sizing each image to its true aspect ratio.
- **Sparse slides read as broken/empty.** Short bullet bodies (1-2 lines) were pinned to the top of
  a 5.65" content column, leaving a large dead gap. Fixed with height-aware vertical centering.
- **Stock-photo appearance.** 5 of 13 slides used generic Pexels keyword-search photos. Switched
  those 5 to Fal AI illustration generation as primary (reusing prompt slots that already existed
  in `fal-ppt-slide-images.ts` as unused Pexels-failure fallbacks), with Pexels demoted to a
  fallback role.
- **Weak typography hierarchy / plain footer.** Restyled header icon (emoji → soft badge), footer
  progress bar (flat rect → rounded pill), continuation-slide marker ("(Continued)" appended to the
  title text → separate small eyebrow label).

**Not yet fixed / still open:**

- **fal.ai reliability.** Every fal.ai call made during this session's testing (~20 real attempts)
  timed out at the library's 90s cap — 100% failure rate, reproducible across 5 separate full-deck
  generations. Parallelized the 10 per-deck image calls (`Promise.all`) so a bad fal.ai day costs
  ~90s instead of up to 15 minutes, and Pexels covers 5 of the 10 slots as a fallback — but the
  other 5 slots (main teaching, SDG/chapter, differentiated activity, exit ticket, success
  criteria) have no fallback and get **no image at all** while fal.ai stays degraded. Needs a check
  against the fal.ai dashboard (balance/rate-limit/outage) — not something checkable from here.
- **No system-prompt-leakage or overflow testing done beyond the one sample lesson used this
  session** ("Grade 3 EVS, Parts of a Plant"). The isolation/dedup logic in
  `ppt-structured-lesson.ts` (stripping forward references, cross-slide duplicate lines) is
  pre-existing and wasn't touched, but hasn't been stress-tested against a wide variety of real
  teacher inputs by this session's work specifically.
- **Text-overflow risk on very long bodies** is handled by the existing chunk-into-"Continued"-
  slides mechanism (untouched logic, only restyled) — still character-count-based estimation, not
  exact PowerPoint text measurement, so it's an approximation, same as before this session.
- **Font size is fixed regardless of content density** — vertical centering fixed the "empty
  page" symptom, but a slide with only one short line still renders at the same body font size as
  a full slide; true Gamma-style "grow text to fill the page" wasn't implemented (flagged as a
  possible follow-up, not started).

---

## 3b. Correction (superseded by `fix/ppt-activity-fal-arabic-generation`)

Two claims in section 3 above were wrong, and one detail in section 1 is stale. Recording them
here rather than editing the original text, so the reasoning that led to them stays visible.

- **"fal.ai reliability: every call timed out at the library's 90s cap, 100% failure rate."**
  This was an artifact of a bug, not a measurement. `withTimeout` in `fal-ppt-slide-images.ts`
  wrapped the `subscribe` call in `try { ... } catch { return null }`, so *every* rejection —
  401, 402, 403, 422, DNS — was converted to the same `null` the timeout produced, and the
  caller then logged "timed out after 90000ms" regardless. The real HTTP status had never been
  observed. Failures are now classified (`FalImageOutcome`), so the actual cause is visible in
  the logs and in Sentry. Whether fal is *also* genuinely slow or unfunded is a separate
  question that this can now answer.

- **"Pexels covers 5 of the 10 slots as a fallback."** True at the time, and the reason the
  product looked like it "uses Pexels instead of Fal": three of the four slides that are
  supposed to carry generated illustrations quietly served a stock photo whenever fal failed.
  Provider policy is now explicit and typed (`SlideImageProviderPolicy`), and deck indices
  1, 6, 7 and 9 are `fal-required` — they render without an image rather than with a substitute.

- **pptxgenjs is 4.0.1, not `^3.x`.** It supports `rtlMode` at both presentation and text level
  plus run-level `lang`, which is what the Arabic RTL work uses.

## 4. Components that are strictly locked (do not touch without explicit sign-off)

- `src/lib/ppt-structured-lesson.ts` — all extraction/sanitization/AFL-injection logic, slide
  titles (EN + AR), slide count (13), slide order, per-slide body-length clamps.
- `src/lib/ppt-slide-by-slide.ts`, `src/lib/afl-tools.ts`, `src/lib/curriculum-framework.ts` — feed
  the above.
- `src/app/api/lesson-plan/route.ts` and `deepseek-lesson-system-prompt.ts` — the AI lesson-planning
  call itself (upstream of the deck builder).
- The **content** of `StructuredLessonSlideModel[]` at the point it's handed to the renderer —
  `slideTitle`, `body`, `speakerNotes`, `aflCallout`. The renderer may read these but must never
  mutate or shorten them (confirmed: it doesn't — `buildPptxFromTemplateEngine` only reads `model.*`
  fields, never reassigns them).

## 5. Components safe to modify (visual/rendering layer only)

- `src/lib/ppt-template-engine.ts` — layout, typography, spacing, per-slide-kind visual treatment.
- `src/lib/ppt-render-primitives.ts` — shared drawing helpers (cards, chips, badges, bullet
  markers, image frames).
- `src/lib/ppt-template-config.ts` + `src/lib/ppt-templates/*.json` — theme tokens (colors, fonts,
  the new `design` block). **Not** safe to change: the 5 theme `id`s / `TEMPLATE_CARDS` metadata
  the dropdown UI depends on, without also updating the UI.
- `src/lib/ppt-image-resolver.ts` — which image source is tried and in what order (content of the
  images themselves, not slide text).
- `src/lib/fal-ppt-slide-images.ts` prompt text per slot — affects what the AI illustration looks
  like, not the lesson content.

## 6. Recommended next-step refactor boundaries

1. **Don't introduce a parallel content schema.** A `LockedSlideContent` wrapper type (as sketched
   in the original prompt) is reasonable as a lightweight, compile-time reminder, but the real
   protection already exists structurally: `ppt-template-engine.ts`'s only content-bearing inputs
   are `model.slideTitle` / `model.body` / `model.speakerNotes` (read-only) — there's no code path
   in the renderer that writes back into the slide model. Adding a full parallel type would mean
   keeping two type definitions in sync for no additional safety. If desired, the cheapest real
   guard is a lint rule or a unit test asserting `buildStructuredLessonSlides()` output is
   unchanged by any renderer-layer commit (diff the `.body`/`.speakerNotes` strings, not the
   `.pptx` bytes).
2. **Next visual work should stay inside "5. Components safe to modify."** Candidates, in rough
   priority order given the open issues above: (a) resolve the fal.ai reliability question before
   trusting Fal-primary sourcing in production, (b) adaptive font sizing for very sparse slides,
   (c) broader stress-testing across real (not hand-written sample) lesson content for
   overflow/pagination edge cases.
3. **Any future request to reorder, merge, split, or reword slides** (including the
   Differentiated-Activity/Mini-Plenary merge flagged in §2) is a pedagogical change and needs
   explicit teacher/product sign-off — not something to infer from a generic "improve the deck"
   instruction, per this session's standing rule.
