# PPT quality and image-provider evaluation brief

**Purpose:** Hand this to an AI reviewer. It should (1) evaluate the current PowerPoint generation pipeline and recommend ways to improve slide *visual* quality and template support, and (2) recommend a replacement or complement for fal.ai image generation.

**Product:** Layah, a Next.js web app. Teachers enter a subject, grade and topic and receive a lesson plan plus a downloadable `.pptx`. Target users are UAE and Indian school teachers, including Arabic-medium classes (RTL).

## 1. Hard constraint: do not change content

Lesson content is written by the DeepSeek API (`deepseek-chat`) and its quality is considered excellent. **Any recommendation must leave slide text, titles, slide order and slide count untouched.** Only the visual layer and image sourcing may change.

The following are locked, and the renderer only reads from them:

- `src/lib/ppt-structured-lesson.ts` (13 slides, English and Arabic titles, per-slide length limits)
- `src/lib/ppt-slide-by-slide.ts`, `src/lib/afl-tools.ts`, `src/lib/curriculum-framework.ts`
- `src/app/api/lesson-plan/route.ts` and `src/lib/deepseek-lesson-system-prompt.ts`

Safe to modify:

- `src/lib/ppt-template-engine.ts`
- `src/lib/ppt-render-primitives.ts`
- `src/lib/ppt-template-config.ts` and `src/lib/ppt-templates/*.json`
- `src/lib/ppt-image-resolver.ts`
- `src/lib/fal-ppt-slide-images.ts` (prompt text and provider calls)
- `python-ppt-api/`

## 2. Current pipeline

```
Teacher inputs (subject, grade, topic, curriculum framework, AFL tool choices, objectives)
  -> DeepSeek writes a lesson plan and a PPT outline
  -> buildStructuredLessonSlides()           deterministic parsing, no AI; exactly 13 slides
       { slideTitle, body, speakerNotes, aflCallout?, includeImageSlot }
  -> generatePptDeckSlideImages()            one image per image slide (10 of 13), run in parallel,
                                             pre-generated when the lesson is created
  -> buildPptxFromTemplateEngine()           pptxgenjs 4.0.1, built-in themes, "Continued" overflow slides
  -> .pptx download                          POST /api/lesson-plan/export/pptx
```

Slide order (deck index: title):

0 Cover, 1 Starter Activity, 2 Chapter/Topic/SDG Goal, 3 Learning Objectives, 4 Learning Outcomes, 5 Main Phase Core Teaching, 6 Differentiated Activity and Mini Plenary, 7 Real Life and Cross Curricular Connection, 8 Plenary, 9 Extended Task, 10 Exit Ticket, 11 Success Criteria and Self Evaluation, 12 Thank You.

### Built-in renderer (`ppt-template-engine.ts`)

- Five themes (classic, modern, warm, dark, minimal), defined as JSON design tokens: colors, fonts, radius, shadow, card and chip colors.
- A `SLIDE_KIND_BY_INDEX` map (hero, checklist, activity, standard) selects the card style, bullet marker and section chip.
- Images are sized to their true aspect ratio by reading the PNG/JPEG/WEBP header, because pptxgenjs's `cover` sizing does not work in the installed version.
- Sparse bodies are vertically centered.
- Long bodies are split into "Continued" slides using a character- and line-count estimate, not real text measurement.
- Arabic uses pptxgenjs `rtlMode` and run-level `lang`.

Known visual weaknesses (from `docs/ppt-flow-audit.md` and the code):

1. Font size is fixed whatever the content density. A one-line slide uses the same body size as a full slide.
2. Overflow splitting is approximate, so some slides may still clip or look cramped.
3. Only four card styles are available. Slides can look repetitive.
4. The audit was done against one sample lesson ("Grade 3 EVS, Parts of a Plant"). Variety testing is limited.

### Uploaded-template path (school's own .pptx), incomplete

- Upload endpoint: `src/app/api/school-template/upload/route.ts`. It accepts `.pptx` up to 15 MB, checks the ZIP signature, scans for malware and extracts theme metadata. The file is stored in the `school_templates` table as base64.
- Export route: when `templateMode === "uploaded"`, it sends the template and the 13 slides to a Python service (`python-ppt-api/`, Flask + python-pptx 1.0.2) via `src/lib/uploaded-ppt-export.ts`.
- **Status:** the service needs `PPT_TEMPLATE_SERVICE_URL` and `PPT_TEMPLATE_SERVICE_SECRET`. Without them the export returns 503 and tells the teacher to use a Layah template. Whether the service is deployed was **not verified**.
- `docs/uploaded-ppt-template-plan.md` describes the intended design. It says the earlier Python code removes the original slides, uses only two layouts, loses slide-level branding and has no fit check.
- The plan's proposed approach:
  - clone the source slides at the package level;
  - fill the identified text and image slots in place;
  - run a fit and validation gate;
  - render and check every output slide;
  - never silently substitute a built-in design.

## 3. Image generation today (fal.ai)

- Client: `@fal-ai/client`. Model: `fal-ai/flux-general`. It was chosen because it accepts a **negative prompt**, which the safety rules need.
- Code: `src/lib/fal-ppt-slide-images.ts` (prompts, one `subscribe` call per slide, 90 s timeout) and `src/lib/fal-flux-section-images.ts` (credentials and error helpers).
- Image slots: sdg_chapter, main_teaching, differentiated_activity, exit_ticket, success_criteria, plus fallback slots for the title, starter, UAE connection, plenary and extended task.
- Fallback: Pexels stock search (`src/lib/pexels-images.ts`) for some slides.
- **Provider policy:** deck indices 1, 6, 7 and 9 are `fal-required`. If fal fails, the slide gets no image rather than a stock photo. The others are `fal-preferred`.
- Prompt rules that any replacement must honor:
  - object-only scenes, with no people, faces, silhouettes or body parts (school and Islamic-appropriate content);
  - no text, letters, digits or equations in the image, because diffusion models render these badly and Arabic worst;
  - 16:9 landscape, with objects complete inside a 7% safe margin;
  - subject-aware object vocabulary (algebra tiles, fraction circles, irrigation, plants, and so on);
  - visual anchors extracted from the lesson text and uploaded source material.
- Negative prompt currently sent: people, faces, text, typography, digits, equations, watermark, cropped or cut-off objects, blank boards, and similar.
- History: an earlier audit claimed "100% of fal calls time out". That was later found to be a bug, since a catch block hid the real HTTP errors. Failures are now classified, so real error codes (401, 402, 403, 422, timeout) appear in logs. **Whether fal is genuinely unreliable, unfunded or slow is still unanswered.**
- Images are pre-generated at lesson creation. The export then embeds the stored URLs and only regenerates missing required slots.

## 4. What to evaluate

### A. Visual quality of the built-in renderer (no content changes)

1. Which specific layout and typography changes would raise perceived quality the most? Consider adaptive font sizing, more layout variants per slide kind, better image and text composition, and hierarchy and spacing.
2. Is pptxgenjs the right tool, or would python-pptx, an HTML-to-PPTX route or a template-based approach give better output? Weigh the cost of migrating and the risk of regressions in Arabic RTL.
3. How should overflow be handled more reliably than character-count estimation? Consider real font metrics or a render-and-check step.
4. What minimal visual test setup (rendered slide screenshots over a varied set of lessons) would catch regressions?

### B. Uploaded school templates

1. Is cloning and editing real source slides (as the plan proposes) the right architecture, or is there a more robust way to apply a school's design to generated content?
2. Is python-pptx adequate for slide cloning with correct relationship remapping, or is a different library or an OOXML-level approach needed?
3. What is the smallest first release that gives teachers real value (for example standard title/body placeholders only) and fails clearly on everything else?
4. How should the service be deployed and secured on Vercel? Options: Python on Vercel, a separate host, or a container.

### C. Image provider

Compare **fal.ai Flux (current)** against at least: Google Imagen or Gemini image models, OpenAI image models, the same Flux model on another host (Replicate, Together and similar), and Vercel AI Gateway image generation. For each, assess:

- adherence to "no people, no text, complete objects in frame";
- support for a negative prompt, or a reliable way to enforce exclusions without one;
- quality on educational and diagram-like scenes across math, science and language;
- latency, because roughly ten images are generated per lesson, in parallel;
- cost per lesson, with current pricing verified at the source;
- reliability, rate limits and a fallback story;
- data and content-policy fit for child and school content;
- integration effort. The app currently has one provider function to replace.

Also say whether a hybrid is better, for example one provider for illustrations and Pexels or Unsplash for photo-style slides.

Recommend a concrete test: the same 13 slides for one lesson through each candidate, scored against the rules in section 3.

## 5. Constraints and context for recommendations

- The owner is semi-technical and the codebase was largely built by a teammate. Prefer the smallest safe change, and say which files change.
- Do not rename routes. Preserve existing APIs and props.
- Stack: Next.js on Vercel, Supabase, Razorpay for payments, Python (Flask) service for the template engine.
- Do not recommend any change to DeepSeek prompts or lesson content.
- Flag claims you could not verify (pricing, model capabilities, current API availability) instead of guessing.

## 6. Requested output

1. A prioritized list of improvements to PPT visual quality, each with expected impact, effort and the files it touches.
2. A recommendation for the image provider with a clear decision rule, plus a migration plan that keeps the safety rules.
3. A recommended path for uploaded templates (build, simplify or defer), with reasons.
4. A list of open questions that need data from the owner, for example fal error logs or the deployment status of the Python service.

## 7. Source files for the reviewer to read

- `docs/ppt-flow-audit.md`, the pipeline audit. Some details are stale; section 3b corrects it.
- `docs/uploaded-ppt-template-plan.md`
- `src/app/api/lesson-plan/export/pptx/route.ts`
- `src/lib/ppt-template-engine.ts` and `src/lib/ppt-render-primitives.ts`
- `src/lib/ppt-image-resolver.ts` and `src/lib/fal-ppt-slide-images.ts`
- `python-ppt-api/main.py` and `python-ppt-api/template_engine.py`
