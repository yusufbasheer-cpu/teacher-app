import {
  AFL_PHASE_GROUPS,
  AFL_PHASE_IDS,
  getAflPhaseForPptSlideNumber1Based,
  type AflPhaseId,
} from "@/lib/afl-tools";
import { isUaeCurriculumFramework } from "@/lib/curriculum-framework";
import {
  isPresentationLanguage,
  isRtlLanguage,
  resolvePresentationLanguage,
  type PresentationLanguage,
} from "@/lib/ppt-language";
import {
  getStructuredLessonSlideTitles,
  PPT_IMAGE_SLIDE_INDEX_SET,
  SLIDE_8_TITLE_LEGACY_EN,
  type StructuredLessonSlideModel,
} from "@/lib/ppt-structured-lesson";
import { DEFAULT_PPT_THEME_ID } from "@/lib/ppt-themes";
import {
  DECK_SCHEMA_VERSION,
  parseDeckSpec,
  type DeckSpec,
  type DeckValidationIssue,
  type EducationalContentBlock,
  type PedagogicalPurpose,
  type SlideSpec,
} from "@/lib/slide-schema";
import { selectDeckCompositions } from "@/lib/slide-layout-engine";

const NOTES_MARKER = "<!--__LAYAH_TEACHER_NOTES__";
const IMAGE_URLS_KEY = "__pptSlideImageUrls";

const LEGACY_SLIDE_PURPOSES: readonly PedagogicalPurpose[] = [
  "opening",
  "classroom-activity",
  "context",
  "learning-objectives",
  "learning-outcomes",
  "concept-explanation",
  "differentiation",
  "connection",
  "plenary",
  "extended-task",
  "formative-assessment",
  "success-criteria",
  "summary",
];

export type LegacyDeckAdapterOptions = {
  /** `lesson_plans.lesson_plan` JSONB, or its JSON-serialized older form. */
  lessonPlan: unknown;
  subject: string;
  grade: string;
  topic?: string;
  /** Use the saved row ID when available to keep IDs stable across edits. */
  deckId?: string;
  /** Omitted saved language keeps the existing subject-derived Arabic behavior. */
  language?: unknown;
  curriculumFramework?: string;
  themeId?: string;
  /** Transient teacher selections are not stored in the current lesson_plan column. */
  aflSelections?: unknown;
};

export type LegacyConversionIssue = {
  path: string;
  code: string;
  message: string;
};

export type LegacyDeckAdapterResult =
  | { ok: true; deck: DeckSpec }
  | { ok: false; issues: LegacyConversionIssue[] };

export type LegacyExportProjection = {
  slides: StructuredLessonSlideModel[];
  /** The current export API takes image URLs separately from its slide models. */
  slideImageUrls: (string | null)[];
};

export type LegacyExportProjectionResult =
  | { ok: true; value: LegacyExportProjection }
  | { ok: false; issues: LegacyConversionIssue[] };

export type StructuredSlidesToDeckOptions = {
  slides: StructuredLessonSlideModel[];
  subject: string;
  grade: string;
  topic: string;
  language?: PresentationLanguage;
  themeId?: string;
  deckId?: string;
  slideImageUrls?: (string | null)[] | null;
};

type ParsedLegacyPlan = {
  plan: Record<string, unknown>;
  pptContent: string;
};

type LegacyHeader = { lineIndex: number; roleIndex: number; title: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function conversionIssue(
  code: string,
  message: string,
  path = "lessonPlan",
): LegacyConversionIssue {
  return { code, message, path };
}

function parseLessonPlan(value: unknown): { ok: true; value: ParsedLegacyPlan } | { ok: false; issue: LegacyConversionIssue } {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return {
        ok: false,
        issue: conversionIssue("malformed_lesson_plan_json", "Saved lesson plan is not valid JSON."),
      };
    }
  }
  if (!isRecord(parsed)) {
    return {
      ok: false,
      issue: conversionIssue("invalid_lesson_plan", "Saved lesson plan must be an object of section strings."),
    };
  }
  for (const [key, section] of Object.entries(parsed)) {
    if (typeof section !== "string") {
      return {
        ok: false,
        issue: conversionIssue("invalid_section_value", `Saved section “${key}” must be a string.`, `lessonPlan.${key}`),
      };
    }
  }
  const pptContent = parsed["PPT Slide Content"];
  if (typeof pptContent !== "string" || !pptContent.trim()) {
    return {
      ok: false,
      issue: conversionIssue(
        "missing_ppt_content",
        "Saved lesson plan has no non-empty “PPT Slide Content” section to convert safely.",
        "lessonPlan.PPT Slide Content",
      ),
    };
  }
  return { ok: true, value: { plan: parsed, pptContent } };
}

function normalizeTitleLine(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "").replace(/^\*\*(.*?)\*\*$/, "$1").trim();
}

function parseTeacherNotesTrailer(
  content: string,
): { ok: true; content: string; notes: string[] } | { ok: false; issue: LegacyConversionIssue } {
  const markerIndex = content.indexOf(NOTES_MARKER);
  if (markerIndex < 0) return { ok: true, content, notes: [] };
  const trailer = content.slice(markerIndex);
  const match = /^<!--__LAYAH_TEACHER_NOTES__([\s\S]*?)-->\s*$/.exec(trailer);
  if (!match) {
    return {
      ok: false,
      issue: conversionIssue("malformed_teacher_notes", "Teacher-notes trailer is incomplete or has trailing unparsed content.", "lessonPlan.PPT Slide Content"),
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(match[1]!.trim()) as unknown;
  } catch {
    return {
      ok: false,
      issue: conversionIssue("malformed_teacher_notes", "Teacher-notes trailer contains invalid JSON.", "lessonPlan.PPT Slide Content"),
    };
  }
  if (!Array.isArray(value) || value.length > LEGACY_SLIDE_PURPOSES.length || value.some((item) => typeof item !== "string")) {
    return {
      ok: false,
      issue: conversionIssue("invalid_teacher_notes", "Teacher-notes trailer must be an array of up to 13 strings.", "lessonPlan.PPT Slide Content"),
    };
  }
  return { ok: true, content: content.slice(0, markerIndex), notes: value as string[] };
}

function parseSlideImageUrls(plan: Record<string, unknown>):
  | { ok: true; urls: (string | null)[] }
  | { ok: false; issue: LegacyConversionIssue } {
  const raw = plan[IMAGE_URLS_KEY];
  if (raw === undefined) return { ok: true, urls: [] };
  if (typeof raw !== "string") {
    return {
      ok: false,
      issue: conversionIssue("invalid_image_metadata", "Saved slide-image metadata must be a JSON string.", `lessonPlan.${IMAGE_URLS_KEY}`),
    };
  }
  if (!raw.trim()) return { ok: true, urls: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      ok: false,
      issue: conversionIssue("malformed_image_metadata", "Saved slide-image metadata is not valid JSON.", `lessonPlan.${IMAGE_URLS_KEY}`),
    };
  }
  if (!Array.isArray(parsed) || parsed.length > LEGACY_SLIDE_PURPOSES.length) {
    return {
      ok: false,
      issue: conversionIssue("invalid_image_metadata", "Slide-image metadata must be an array with at most 13 entries.", `lessonPlan.${IMAGE_URLS_KEY}`),
    };
  }
  const urls: (string | null)[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const value = parsed[index];
    if (value === null || value === "") {
      urls.push(null);
      continue;
    }
    if (typeof value !== "string") {
      return {
        ok: false,
        issue: conversionIssue("invalid_image_url", `Image URL at index ${index} must be a string or null.`, `lessonPlan.${IMAGE_URLS_KEY}[${index}]`),
      };
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    } catch {
      return {
        ok: false,
        issue: conversionIssue("invalid_image_url", `Image URL at index ${index} must be an absolute HTTP or HTTPS URL.`, `lessonPlan.${IMAGE_URLS_KEY}[${index}]`),
      };
    }
    urls.push(value);
  }
  return { ok: true, urls };
}

function parseAflSelections(value: unknown):
  | { ok: true; selections: Partial<Record<AflPhaseId, string[]>> }
  | { ok: false; issue: LegacyConversionIssue } {
  if (value === undefined) return { ok: true, selections: {} };
  if (!isRecord(value)) {
    return { ok: false, issue: conversionIssue("invalid_afl_metadata", "AFL selections must be an object keyed by supported phase.", "aflSelections") };
  }
  const knownPhases = new Set<string>(AFL_PHASE_IDS);
  const selections: Partial<Record<AflPhaseId, string[]>> = {};
  for (const [rawPhase, rawIds] of Object.entries(value)) {
    if (!knownPhases.has(rawPhase)) {
      return { ok: false, issue: conversionIssue("invalid_afl_phase", `Unsupported AFL phase “${rawPhase}”.`, `aflSelections.${rawPhase}`) };
    }
    if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== "string" || !id.trim())) {
      return { ok: false, issue: conversionIssue("invalid_afl_tool_ids", "AFL tool selections must be an array of non-empty IDs.", `aflSelections.${rawPhase}`) };
    }
    const phase = rawPhase as AflPhaseId;
    const allowed = new Set(AFL_PHASE_GROUPS.find((group) => group.phase === phase)?.tools.map((tool) => tool.id) ?? []);
    const ids = rawIds as string[];
    if (ids.some((id) => !allowed.has(id)) || new Set(ids).size !== ids.length) {
      return { ok: false, issue: conversionIssue("invalid_afl_tool_ids", `AFL tools must be unique and belong to the ${phase} phase.`, `aflSelections.${phase}`) };
    }
    if (ids.length > 0) selections[phase] = [...ids];
  }
  return { ok: true, selections };
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

/**
 * Lossless bridge from the app's fixed 13-role lesson model into the richer, versioned schema.
 * It preserves each learner-facing body as a paragraph and keeps notes and image URLs separate.
 */
export function adaptStructuredLessonSlidesToDeck(options: StructuredSlidesToDeckOptions): LegacyDeckAdapterResult {
  if (!options.subject.trim() || !options.grade.trim() || options.slides.length === 0) {
    return { ok: false, issues: [conversionIssue("incomplete_structured_deck", "Subject, grade, and at least one slide are required.", "slides")] };
  }
  if (options.slides.length > LEGACY_SLIDE_PURPOSES.length) {
    return { ok: false, issues: [conversionIssue("unsupported_slide_count", "The current lesson generator supports its existing 13 logical slide roles.", "slides")] };
  }
  const language = resolvePresentationLanguage({ language: options.language, subject: options.subject });
  const deckId = options.deckId?.trim() || `generated-deck-${stableHash(`${options.subject}|${options.grade}|${options.topic}`)}`;
  const slides: SlideSpec[] = options.slides.map((model, order) => {
    const imageUrl = options.slideImageUrls?.[order] ?? null;
    const contentBlocks: EducationalContentBlock[] = model.body.trim() ? [{ type: "paragraph", text: model.body }] : [];
    if (model.aflCallout?.trim()) contentBlocks.push({ type: "keyIdea", label: "Check for understanding", text: model.aflCallout.trim() });
    // The schema needs one non-empty block; an empty slide (e.g. no learning objectives given) used to fail the whole
    // export. It gets the same placeholder the slide writer uses for a missing body.
    if (contentBlocks.length === 0) contentBlocks.push({ type: "paragraph", text: "(Content unavailable for this slide.)" });
    return {
      id: `slide-${stableHash(deckId)}-${String(order + 1).padStart(2, "0")}`,
      order,
      title: model.slideTitle,
      pedagogicalPurpose: LEGACY_SLIDE_PURPOSES[order]!,
      centralTakeaway: null,
      contentBlocks,
      layoutIntent: { image: imageUrl || model.includeImageSlot ? "optional" : "avoid" },
      ...(imageUrl ? { image: { url: imageUrl, fit: "contain" as const } } : {}),
      speakerNotes: model.speakerNotes ?? "",
    };
  });
  const candidate: DeckSpec = {
    id: deckId,
    schemaVersion: DECK_SCHEMA_VERSION,
    subject: options.subject.trim(),
    grade: options.grade.trim(),
    topic: options.topic,
    language,
    textDirection: isRtlLanguage(language) ? "rtl" : "ltr",
    theme: { id: options.themeId?.trim() || DEFAULT_PPT_THEME_ID },
    slides,
  };
  const selected = selectDeckCompositions(candidate);
  if (!selected.ok) {
    return { ok: false, issues: selected.issues.map((item) => ({ path: item.slideId, code: item.code, message: item.message })) };
  }
  return { ok: true, deck: selected.deck };
}

function knownTitles(language: PresentationLanguage, uaeFrameworkSelected: boolean): Map<string, number> {
  const canonical = getStructuredLessonSlideTitles(language === "ar", uaeFrameworkSelected);
  const lookup = new Map<string, number>();
  canonical.forEach((title, index) => lookup.set(title, index));
  if (language !== "ar") {
    for (const legacyTitle of SLIDE_8_TITLE_LEGACY_EN) lookup.set(legacyTitle, 7);
  }
  return lookup;
}

function inferLegacyLanguage(
  explicitLanguage: unknown,
  subject: string,
  pptContent: string,
  uaeFrameworkSelected: boolean,
): PresentationLanguage {
  if (isPresentationLanguage(explicitLanguage)) return explicitLanguage;
  const arabicTitles = knownTitles("ar", uaeFrameworkSelected);
  const englishTitles = knownTitles("en", uaeFrameworkSelected);
  const recognizedCount = (titles: Map<string, number>) => {
    const found = new Set<number>();
    for (const line of pptContent.replace(/\r\n/g, "\n").split("\n")) {
      const role = titles.get(normalizeTitleLine(line));
      if (role !== undefined) found.add(role);
    }
    return found.size;
  };
  const arabicCount = recognizedCount(arabicTitles);
  const englishCount = recognizedCount(englishTitles);
  if (arabicCount > englishCount) return "ar";
  if (englishCount > arabicCount) return "en";
  return resolvePresentationLanguage({ language: explicitLanguage, subject });
}

function parseLegacySlideSections(
  content: string,
  titles: Map<string, number>,
): { ok: true; headers: LegacyHeader[]; bodiesByRole: string[] } | { ok: false; issue: LegacyConversionIssue } {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const headers: LegacyHeader[] = [];
  lines.forEach((line, lineIndex) => {
    const normalized = normalizeTitleLine(line);
    const roleIndex = titles.get(normalized);
    if (roleIndex !== undefined) headers.push({ lineIndex, roleIndex, title: normalized });
  });
  if (headers.length === 0) {
    return { ok: false, issue: conversionIssue("unrecognized_ppt_content", "No recognized Layah slide headings were found in the saved PPT content.", "lessonPlan.PPT Slide Content") };
  }
  if (lines.slice(0, headers[0]!.lineIndex).some((line) => line.trim())) {
    return { ok: false, issue: conversionIssue("unassigned_ppt_content", "Text before the first recognized slide heading cannot be assigned to a slide safely.", "lessonPlan.PPT Slide Content") };
  }
  const seenRoles = new Set<number>();
  for (const header of headers) {
    if (seenRoles.has(header.roleIndex)) {
      return { ok: false, issue: conversionIssue("duplicate_slide_heading", `Slide heading “${header.title}” appears more than once.`, "lessonPlan.PPT Slide Content") };
    }
    seenRoles.add(header.roleIndex);
  }
  if (seenRoles.size !== LEGACY_SLIDE_PURPOSES.length) {
    const missing = LEGACY_SLIDE_PURPOSES.map((_, index) => index + 1).filter((number) => !seenRoles.has(number - 1));
    return {
      ok: false,
      issue: conversionIssue("incomplete_ppt_content", `Saved PPT content is missing recognized slide heading(s): ${missing.join(", ")}.`, "lessonPlan.PPT Slide Content"),
    };
  }
  const bodiesByRole: string[] = Array(LEGACY_SLIDE_PURPOSES.length).fill("");
  for (const [headerIndex, header] of headers.entries()) {
    const next = headers[headerIndex + 1];
    const end = next?.lineIndex ?? lines.length;
    const body = lines.slice(header.lineIndex + 1, end).join("\n").trim();
    if (!body) return {
      ok: false,
      issue: conversionIssue("empty_slide_body", `Slide ${header.roleIndex + 1} has no student-facing body text.`, "lessonPlan.PPT Slide Content"),
    };
    bodiesByRole[header.roleIndex] = body;
  }
  return { ok: true, headers, bodiesByRole };
}

function purposeForRole(roleIndex: number): PedagogicalPurpose {
  return LEGACY_SLIDE_PURPOSES[roleIndex]!;
}

/**
 * Convert saved text-section lesson plans into schema v1 without regenerating or paraphrasing
 * learner-facing text. Unknown content is kept inside its slide body; ambiguous boundaries fail.
 */
export function adaptLegacyLessonPlanToDeck(options: LegacyDeckAdapterOptions): LegacyDeckAdapterResult {
  if (typeof options.subject !== "string" || !options.subject.trim()) {
    return { ok: false, issues: [conversionIssue("missing_subject", "Subject is required to identify this deck.", "subject")] };
  }
  if (typeof options.grade !== "string" || !options.grade.trim()) {
    return { ok: false, issues: [conversionIssue("missing_grade", "Grade is required to identify this deck.", "grade")] };
  }

  const legacy = parseLessonPlan(options.lessonPlan);
  if (!legacy.ok) return { ok: false, issues: [legacy.issue] };
  const trailer = parseTeacherNotesTrailer(legacy.value.pptContent);
  if (!trailer.ok) return { ok: false, issues: [trailer.issue] };
  const uaeFrameworkSelected = isUaeCurriculumFramework(options.curriculumFramework ?? "");
  const language = inferLegacyLanguage(options.language, options.subject, trailer.content, uaeFrameworkSelected);
  const titles = knownTitles(language, uaeFrameworkSelected);
  const parsedSlides = parseLegacySlideSections(trailer.content, titles);
  if (!parsedSlides.ok) return { ok: false, issues: [parsedSlides.issue] };
  const imageUrls = parseSlideImageUrls(legacy.value.plan);
  if (!imageUrls.ok) return { ok: false, issues: [imageUrls.issue] };
  const afl = parseAflSelections(options.aflSelections);
  if (!afl.ok) return { ok: false, issues: [afl.issue] };

  const deckSeed = `${options.subject.trim()}|${options.grade.trim()}|${options.topic?.trim() ?? ""}|${options.deckId ?? ""}`;
  const deckId = options.deckId?.trim() || `legacy-deck-${stableHash(deckSeed)}`;
  const slides: SlideSpec[] = parsedSlides.headers.map((header, order) => {
    const roleIndex = header.roleIndex;
    const slideNumber1Based = roleIndex + 1;
    const phase = getAflPhaseForPptSlideNumber1Based(slideNumber1Based);
    const selectedToolIds = phase ? afl.selections[phase] : undefined;
    const imageUrl = imageUrls.urls[roleIndex] ?? null;
    const legacyImageSlot = PPT_IMAGE_SLIDE_INDEX_SET.has(roleIndex);
    const contentBlock: EducationalContentBlock = {
      type: "paragraph",
      text: parsedSlides.bodiesByRole[roleIndex]!,
    };
    return {
      id: `slide-${stableHash(deckId)}-${String(roleIndex + 1).padStart(2, "0")}`,
      order,
      title: header.title,
      pedagogicalPurpose: purposeForRole(roleIndex),
      centralTakeaway: null,
      contentBlocks: [contentBlock],
      layoutIntent: { image: imageUrl || legacyImageSlot ? "optional" : "avoid" },
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
      ...(phase && selectedToolIds?.length
        ? { afl: { phase, selectedToolIds: [...selectedToolIds], provenance: "teacher-selected" as const } }
        : {}),
      speakerNotes: trailer.notes[roleIndex] ?? "",
    };
  });

  const deck: DeckSpec = {
    id: deckId,
    schemaVersion: DECK_SCHEMA_VERSION,
    subject: options.subject.trim(),
    grade: options.grade.trim(),
    ...(options.topic !== undefined ? { topic: options.topic } : {}),
    language,
    textDirection: isRtlLanguage(language) ? "rtl" : "ltr",
    theme: { id: options.themeId?.trim() || DEFAULT_PPT_THEME_ID },
    slides,
  };
  const validation = parseDeckSpec(deck);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((item: DeckValidationIssue) => ({ ...item })) };
  }
  return { ok: true, deck: validation.value };
}

/**
 * Compatibility bridge for the existing PptxGenJS path. It intentionally accepts only
 * paragraph/key-idea decks and refuses compositions or structured diagrams the current renderer
 * cannot faithfully express yet.
 */
export function projectDeckToLegacyExport(deckValue: unknown): LegacyExportProjectionResult {
  const validation = parseDeckSpec(deckValue);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((item) => ({ ...item })) };
  }
  const deck = validation.value;
  const canonicalPurposes = LEGACY_SLIDE_PURPOSES;
  if (deck.slides.length !== canonicalPurposes.length || deck.slides.some((slide, index) => slide.pedagogicalPurpose !== canonicalPurposes[index])) {
    return {
      ok: false,
      issues: [conversionIssue("unsupported_legacy_sequence", "The current PPT renderer only accepts the existing 13-slide role sequence.", "slides")],
    };
  }
  const slides: StructuredLessonSlideModel[] = [];
  for (const [index, slide] of deck.slides.entries()) {
    if (slide.composition !== undefined || slide.contentBlocks.length !== 1) {
      return {
        ok: false,
        issues: [conversionIssue("unsupported_legacy_structure", `Slide ${index + 1} uses content or composition data the current renderer cannot represent without loss.`, `slides[${index}]`)],
      };
    }
    const block = slide.contentBlocks[0];
    if (block?.type !== "paragraph" && block?.type !== "keyIdea") {
      return {
        ok: false,
        issues: [conversionIssue("unsupported_legacy_block", `Slide ${index + 1} is not a plain text block supported by the current renderer.`, `slides[${index}].contentBlocks[0]`)],
      };
    }
    if (block.type === "keyIdea" && block.label) {
      return {
        ok: false,
        issues: [conversionIssue("unsupported_legacy_block", `Slide ${index + 1} has a labeled key idea that the current renderer cannot faithfully preserve.`, `slides[${index}].contentBlocks[0]`)],
      };
    }
    slides.push({
      slideTitle: slide.title,
      body: block.text,
      speakerNotes: slide.speakerNotes,
      ...(slide.afl?.callout ? { aflCallout: slide.afl.callout } : {}),
      includeImageSlot: slide.layoutIntent.image === "optional" || slide.layoutIntent.image === "required",
    });
  }
  return {
    ok: true,
    value: {
      slides,
      slideImageUrls: deck.slides.map((slide) => slide.image?.url ?? null),
    },
  };
}

