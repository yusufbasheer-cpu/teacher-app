# Uploaded PowerPoint templates: implementation proposal

Status: first release implemented in source, 19 September 2026; deployment configuration is pending. It uses the existing upload table and synchronous Python rendering. Private object storage, a durable job queue, slide preview review, and pixel-level rendering validation described below remain proposed follow-up work.

## Intended behavior

Teachers can choose an existing Layah design or upload a PowerPoint to use as the design source. Accept both a blank template deck and a completed presentation saved as `.pptx`. Replace the old lesson content with the generated lesson while retaining the supported design elements. Deliver a validated, editable `.pptx`. If the lesson cannot be fitted reliably, explain why and offer an explicit switch to a Layah design.

## Findings in this checkout

- `src/components/lesson-plan/teacher-package-viewer.tsx` contains the design cards and PPT download handler. It currently sends only a built-in `pptTheme`; failed HTTP responses become a generic error.
- `src/app/api/lesson-plan/export/pptx/route.ts` builds the structured lesson and resolves images, then calls the built-in renderer. It does not load an uploaded template.
- `src/app/api/school-template/upload/route.ts` already accepts `.pptx` up to 15 MB, authenticates the teacher, checks the ZIP signature, invokes the available malware scanner, extracts theme metadata, and saves the source as base64. GET returns metadata; DELETE removes the saved record. No upload UI or current export integration was found in `src`.
- `src/lib/pptx-template.ts` extracts colors, fonts, a logo and thumbnail. Its `injectTemplateDesign` helper copies masters/layouts/themes into a generated package and can silently return the generated file on failure. It does not map lesson content into original slide shapes. Do not use this helper as the new renderer.
- `python-ppt-api/main.py` already opens uploaded decks, but removes original slides, selects two layouts, and adds replacement text. This loses slide-level design, uses a stale slide-role map, and lacks a fit gate. It is a possible service location, not a finished template engine. Its deployment availability was not verified.
- `src/lib/ppt-quality-report.ts` is an offline heuristic for built-in layouts, not a validation gate for uploaded decks.
- `docs/ppt-flow-audit.md` records a requirement to preserve lesson content and its 13 logical sections. Current source also has content-safety transformations. Reuse the current canonical content path and safety rules; add template fitting after them.
- Template table setup appears in source comments; a tracked `school_templates` migration was not found. Inspect the deployed schema before preparing an idempotent migration.

## Proposed first-release scope

- Support editable `.pptx` decks, including completed decks and blank template slides. Legacy `.ppt`, `.potx`, macro-enabled and password-protected files receive clear format guidance; conversion is a separate feature.
- Preserve slide size, theme, backgrounds, logos, decorative shapes, layout positions, typography and supported image frames. Preserve the source file separately.
- Replace text and lesson imagery only in identified content slots. Keep school branding. Do not carry old lesson pictures, dates, hidden slides, notes or comments into the new lesson by accident.
- Reuse suitable source slides as designs; uploaded slide count need not equal generated slide count. Maintain the generated lesson's logical order. Disclose that designs may repeat and continuation slides may be added.
- Support standard title/body placeholders, ordinary text boxes, simple columns and picture frames. Grouped or ambiguous elements require reliable interpretation or a small mapping review; do not guess destructively.
- SmartArt, charts, equations and embedded objects that need content replacement are unsupported initially. Unchanged decorative objects may remain only when preservation and rendering are verified. A slide with baked-in old text cannot be treated as an editable background.
- One active saved template per teacher initially, consistent with the existing account model. Multiple templates and school-wide libraries are later additions.

## Teacher flow

1. Extend the existing PPT design selector with `Layah templates` and `Upload my PowerPoint`. Make the option available when exporting newly generated or saved lessons.
2. Upload or choose the saved file. Show filename, source slide previews, replace/remove controls, and analysis progress.
3. Run structural compatibility analysis. Report `Ready to use`, `Needs review`, or `Cannot use this template`. A ready upload means the design is usable; lesson-specific fit is checked during export.
4. Where mappings are ambiguous, show the relevant source slide and let the teacher identify the title/body/image region or keep an element as branding. Common templates should work automatically.
5. On export, reuse the generated lesson and images, map them to source designs, fit, render and validate. Show progress as `Preparing slides` and `Checking layout`.
6. On success, download the PPT and show a brief notice if extra slides were necessary. Previews come from the validated output.
7. On incompatibility, show a persistent dialog with the affected lesson sections and a plain-language reason. Offer `Use a Layah template`, `Upload another PowerPoint`, and `Cancel`. Choosing Layah returns to the existing design choices and exports the same lesson; it does not consume another lesson generation.

Suggested warning:

> We couldn't fit all your lesson content into this PowerPoint while keeping its design readable. The Main Teaching section needs more space than the available layouts provide. Use a Layah template to include the complete lesson, or upload another PowerPoint.

Use specific variants for non-editable slides, missing fonts and unsupported objects. A service timeout should say `We couldn't finish checking your template. Please retry.` It must not claim the template is incompatible. Never silently substitute a built-in design.

## Mapping and fit policy

Build an immutable analysis manifest recording source slide and shape IDs, master/layout relationships, inherited styles, bounds, rotation, margins, paragraph levels, image crops, editable roles and mapping confidence. Distinguish replaceable content, preserved design and ambiguous objects.

Prefer explicit placeholders, followed by clearly identifiable text and image shapes. Match generated slide roles to compatible designs rather than copying source order or cycling blindly. Record each content fragment's destination so completeness can be verified. Optional visual classification may assist ambiguous cases, but uploaded text remains untrusted source data, never instructions to the generator.

Try these steps in order:

1. Fill the chosen design using its existing fonts, text sizes, paragraph styles and bounds.
2. Reflow within those bounds and make small, bounded paragraph-spacing adjustments. Do not truncate text or cover decorations.
3. Try another suitable layout from the uploaded deck with greater capacity.
4. Add continuation slides by duplicating a compatible source design, splitting at paragraph or bullet boundaries and retaining lesson order. Proposed initial cap: three physical slides per logical section, subject to calibration in the first milestone. Failure to fit within supported rules is not proof that fitting is mathematically impossible; the UI should say we could not fit it reliably.
5. If fit still fails, return an actionable compatibility result. Preserve font size in v1 rather than shrinking text arbitrarily. Do not rewrite learning objectives, omit activities, move student content into notes or regenerate content to disguise overflow.

Retain generated speaker notes and current intentional teacher-facing-note handling. Required educational images must have compatible destinations; optional decorative images can be omitted with a notice. Determine required versus decorative status explicitly rather than assuming every image is optional.

## Renderer and validation design

Keep the existing built-in renderer. Add a separate uploaded-template renderer that starts from the source package, clones selected original slides with their dependencies, and edits mapped elements in place. PresentationML distributes information across slides, masters, layouts and related parts, so preservation must include that relationship graph. [Microsoft's format documentation](https://learn.microsoft.com/en-us/office/open-xml/presentation/structure-of-a-presentationml-document).

Recommended implementation direction: an isolated Python worker, using the existing service as a deployment candidate, with targeted OOXML operations for source-slide cloning and formatting preservation. `python-pptx` supports editing existing presentations; confirm preservation against real fixtures before committing to its serialization path. [Library documentation](https://python-pptx.readthedocs.io/en/latest/user/presentations.html).

Do not implement import by copying theme ZIP entries into a fresh deck. Cloning must remap package relationships, slide/shape references, media, notes, hyperlinks and content types without collisions. Preserve untouched theme/design parts wherever possible and remove unused old lesson material from the delivered package. Reject unsupported relationships rather than producing a file that PowerPoint repairs.

Fit estimation must account for actual font metrics, text shaping, bounds, margins, indentation, line breaks and English/Arabic direction. A generic `fit_text` call applies a font size across the frame and depends on matching fonts; it is insufficient by itself for preserving mixed styles. [Text API documentation](https://python-pptx.readthedocs.io/en/latest/api/text.html).

Before delivery, validate package relationships and content coverage, then render every output slide in the worker. Check wrapping, clipping, missing glyphs, changed regions and newly introduced overlap. Preserve intentional overlaps present in the source. Combine measurements with rendered comparisons; character counts and screenshots alone do not establish reliable fit. Calibrate using PowerPoint visual checks during development, since another renderer may differ. Missing fonts or inconclusive checks prevent a `Ready` result.

Milestone 1 must establish acceptable fidelity and a usable rendering runtime. If the worker cannot meet that standard, evaluate another renderer before implementing the full UI. Do not promise universal pixel-identical support for arbitrary PowerPoint features.

## Persistence, API and operation

- Store originals and previews in private object storage; keep owner, filename, checksum, version, storage key, manifest, analysis state and issue list in the database. Migrate existing base64 templates with a read-compatible transition. Template replacement creates a new version so running jobs retain stable inputs.
- Use owner-scoped storage and database policies. Export takes an authorized template ID and version, never a client-supplied storage path. Revalidate stored uploads before processing. Add/remove must clean up related objects and expired jobs.
- Extend upload/metadata endpoints; return the template ID and analysis job state. A direct private-storage upload followed by authenticated finalization avoids sending a large file through a small application request limit; verify deployment limits before fixing the upload transport.
- Preserve the current built-in export request. Add a discriminated selection such as `{ mode: "uploaded", templateId, templateVersion }`; built-in callers continue using `pptTheme`.
- For uploaded exports, return `202` with an owner-scoped job ID. A status endpoint returns `queued | analyzing | mapping | rendering | validating | ready | needs_review | incompatible | failed` and structured issues. Return a short-lived download URL only for `ready`.
- Key jobs/cache by owner, template checksum/version, canonical lesson hash, image identities, language and renderer version. Deduplicate retries and reject stale results after template changes. Fallback uses the same content snapshot and existing image results.
- Use issue codes such as `NO_EDITABLE_CONTENT`, `AMBIGUOUS_MAPPING`, `TEXT_OVERFLOW`, `REQUIRED_IMAGE_SLOT_MISSING`, `FONT_UNAVAILABLE`, `UNSUPPORTED_CONTENT`, and `VALIDATION_FAILED`. Keep operational errors separate.
- Add bounded processing time, archive/resource limits and isolated rendering without external-link fetching. Existing upload scan assumptions must be revisited because the new flow actively renders untrusted documents. Authenticate worker calls; do not expose an unrestricted generation endpoint.
- Measure analysis/render time, failure reasons, continuation count and fallback selection without logging uploaded lesson content. Feature-flag rollout. Built-in exports remain available if the worker is unavailable.

## Implementation milestones and acceptance

1. **Fidelity proof:** run representative placeholder, completed, slide-level-branded, multi-layout, 4:3, 16:9, English and Arabic decks through inspect/clone/fill/render. Include grouped and non-editable failure cases. Confirm design preservation, font availability, package integrity and fit checks before selecting the final worker implementation.
2. **Template foundation:** migrations, private storage, upload analysis, manifest, saved-template management and owner-scoped APIs. Verify migration compatibility and replacement/deletion behavior.
3. **Content mapping and export:** source-based renderer, preserved canonical content, image mapping, continuation policy, validation, jobs and typed incompatibility responses.
4. **Teacher experience:** upload/selection/review UI, progress, validated download and explicit Layah fallback. Integrate saved-lesson exports and handle structured errors before the current generic error handler.
5. **Regression and rollout:** test short/long lessons, long titles, mixed scripts, notes, stale source content, source slide-count mismatch, unsupported objects, missing fonts, failed uploads, worker timeouts, repeated clicks and cross-account access. Verify PPTs open without repair prompts, every required content fragment appears, supported design remains intact, and fallback neither regenerates the lesson nor increments lesson usage. Run repository typecheck/lint/build and relevant existing PPT tests, then release behind a flag.

The implementation is ready for release when supported uploads produce readable, editable, design-preserving decks and every unsupported or unverified case gives an actionable choice without delivering a misleading substitute.
