import type { AflSelectionsPayload } from "@/lib/afl-tools";

/** Current AI package: six top-level outputs from DeepSeek. */
export const TEACHER_PACKAGE_SECTIONS = [
  "Full Lesson Plan",
  "PPT Slide Content",
  "Worksheet",
  "Assessment Questions",
  "Homework Task",
  "Teacher Notes",
] as const;

/** Short labels for tabs / downloads (maps API JSON keys to UI copy). */
export const SECTION_TAB_LABELS: Record<string, string> = {
  "Full Lesson Plan": "Lesson Plan",
  "PPT Slide Content": "PPT Content",
  Worksheet: "Worksheet",
  "Assessment Questions": "Assessment Questions",
  "Homework Task": "Homework",
  "Teacher Notes": "Teacher Notes",
};

export function getSectionTabLabel(sectionKey: string): string {
  return SECTION_TAB_LABELS[sectionKey] ?? sectionKey;
}

/** Curriculum dropdown (lesson generator). */
export const CURRICULUM_TYPE_OPTIONS = [
  "CBSE/NCERT",
  "British",
  "American",
  "UAE MOE",
  "IB",
  "Other",
] as const;
export type CurriculumTypeOption = (typeof CURRICULUM_TYPE_OPTIONS)[number];

/** Grade / year group dropdown (Grade 1 … Grade 12). */
export const GRADE_YEAR_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
] as const;
export type GradeYearOption = (typeof GRADE_YEAR_OPTIONS)[number];

/** Core (non-language) subjects in the lesson generator dropdown. */
export const CORE_SUBJECT_OPTIONS = [
  "Math",
  "Science",
  "English",
  "Islamic Studies",
  "Social Science",
  "ICT",
  "Art",
  "PE",
  "Other",
] as const;

/** Language subjects — separate group in the dropdown. */
export const LANGUAGE_SUBJECT_OPTIONS = [
  "Hindi",
  "Urdu",
  "Malayalam",
  "Tamil",
  "Telugu",
  "Kannada",
  "Bengali",
  "Punjabi",
  "Gujarati",
  "Marathi",
  "Spanish",
  "French",
  "German",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Portuguese",
  "Italian",
  "Russian",
  "Arabic",
] as const;

/** All valid subject dropdown values (core + language). */
export const SUBJECT_OPTIONS = [
  ...CORE_SUBJECT_OPTIONS,
  ...LANGUAGE_SUBJECT_OPTIONS,
] as const;
export type CoreSubjectOption = (typeof CORE_SUBJECT_OPTIONS)[number];
export type LanguageSubjectOption = (typeof LANGUAGE_SUBJECT_OPTIONS)[number];
export type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

export function isLanguageTeachingSubject(value: string): value is LanguageSubjectOption {
  return (LANGUAGE_SUBJECT_OPTIONS as readonly string[]).includes(value.trim());
}

/** Arabic lessons use Arabic PPT slide titles; other languages keep English slide titles. */
export function usesArabicPptSlideTitles(subject: string): boolean {
  return subject.trim() === "Arabic";
}

/** Earlier app versions saved this six-part legacy shape. */
export const LEGACY_LESSON_PLAN_SECTIONS = [
  "Starter Activity",
  "Main Phase",
  "Transdisciplinary Connection",
  "Interdisciplinary Connection",
  "Extended Task",
  "CCL",
] as const;

export type TeacherPackageSectionKey = (typeof TEACHER_PACKAGE_SECTIONS)[number];
export type LegacyLessonPlanSectionKey = (typeof LEGACY_LESSON_PLAN_SECTIONS)[number];

/**
 * Delimiter lines the model must use around each section (plain text, not JSON).
 * Used by the DeepSeek prompt and by `parse-teacher-package-response.ts`.
 */
export const TEACHER_PACKAGE_BLOCK_MARKERS: Record<
  TeacherPackageSectionKey,
  readonly [start: string, end: string]
> = {
  "Full Lesson Plan": ["LESSON PLAN START", "LESSON PLAN END"],
  "PPT Slide Content": ["PPT CONTENT START", "PPT CONTENT END"],
  Worksheet: ["WORKSHEET START", "WORKSHEET END"],
  "Assessment Questions": ["ASSESSMENT QUESTIONS START", "ASSESSMENT QUESTIONS END"],
  "Homework Task": ["HOMEWORK TASK START", "HOMEWORK TASK END"],
  "Teacher Notes": ["TEACHER NOTES START", "TEACHER NOTES END"],
};

/** Checkbox labels on the generator form (maps API JSON keys to user-facing copy). */
export const GENERATION_CHECKBOX_LABELS: Record<TeacherPackageSectionKey, string> = {
  "Full Lesson Plan": "Lesson Plan",
  "PPT Slide Content": "PPT Slides",
  Worksheet: "Worksheet",
  "Assessment Questions": "Assessment Questions",
  "Homework Task": "Homework Task",
  "Teacher Notes": "Teacher Notes",
};

export type LessonPlanInput = {
  curriculumType: string;
  /** Optional jurisdictional framework; empty string = none (see `curriculum-framework.ts`). */
  curriculumFramework: string;
  grade: string;
  subject: string;
  chapter: string;
  topic: string;
  learningObjectives: string;
};

export function isValidCurriculumType(value: string): value is CurriculumTypeOption {
  return (CURRICULUM_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function isValidGradeYear(value: string): value is GradeYearOption {
  return (GRADE_YEAR_OPTIONS as readonly string[]).includes(value);
}

export function isValidSubjectOption(value: string): value is SubjectOption {
  return (SUBJECT_OPTIONS as readonly string[]).includes(value);
}

const TEACHER_PASTED_SOURCE_MARKER = "===== Teacher-pasted content (PRIMARY — mandatory basis) =====";

/**
 * Merges pasted text (primary) with upload-extracted text for DeepSeek prompts.
 * Truncates to {@link SOURCE_MATERIAL_MAX_CHARS} total.
 */
export function buildGenerationSourceMaterial(params: {
  pastedContent?: string;
  uploadedExtractedText?: string;
}): string | undefined {
  const pasted = params.pastedContent?.trim() ?? "";
  const uploaded = params.uploadedExtractedText?.trim() ?? "";
  const parts: string[] = [];
  if (pasted) {
    parts.push(`${TEACHER_PASTED_SOURCE_MARKER}\n${pasted}`);
  }
  if (uploaded) parts.push(uploaded);
  const combined = parts.join("\n\n").trim();
  if (!combined) return undefined;
  return combined.slice(0, SOURCE_MATERIAL_MAX_CHARS);
}

export function generationSourceIncludesTeacherPaste(sourceMaterial: string | undefined): boolean {
  return Boolean(sourceMaterial?.includes(TEACHER_PASTED_SOURCE_MARKER));
}

export function buildSourceMaterialPromptBlock(sourceMaterial: string): string {
  const trimmed = sourceMaterial.trim().slice(0, SOURCE_MATERIAL_MAX_CHARS);
  if (generationSourceIncludesTeacherPaste(trimmed)) {
    return `

### Teacher-provided source material (MANDATORY — pasted content is PRIMARY)
The teacher pasted content below deliberately. When pasted content is present, treat it as the **authoritative basis** for the **entire** teacher package: lesson plan, PPT, worksheet, assessment questions, homework, and teacher notes. Generate **strictly** from what they provided — do **not** ignore, override, contradict, or replace it with generic curriculum filler. Use curriculum, grade, topic, and objectives only where they align with and do not contradict the pasted material.

${trimmed}
`;
  }
  return `

### Source material (from teacher-uploaded file(s): PDF and/or images — primary content basis)
Use the following extracted text as the main factual and instructional basis for every section you generate. Ground examples, definitions, sequencing, and practice tasks in this material while still honoring the curriculum, grade, topic, and learning objectives below. If the source is partial, infer sensible teaching structure and label reasonable inferences clearly.

${trimmed}
`;
}

/** Max characters of upload-derived text sent into generation (truncated server-side). */
export const SOURCE_MATERIAL_MAX_CHARS = 80_000;

/** POST /api/lesson-plan body: class context plus which teacher-package sections to generate. */
export type LessonPlanGenerateBody = LessonPlanInput & {
  sections: TeacherPackageSectionKey[];
  /** Plain text extracted from uploaded PDFs/images (optional). */
  sourceMaterial?: string;
  /** Teacher-pasted notes/chapter text (optional; takes priority over uploads when present). */
  pastedContent?: string;
  /** Selected AFL tool ids by phase (see `afl-tools.ts`). */
  aflSelections?: AflSelectionsPayload;
  /**
   * When true and **PPT Slide Content** is requested, the API responds with **NDJSON** lines:
   * `{"type":"progress","message":"…"}` then `{"type":"complete",…}` (or `{"type":"error",…}`).
   * Otherwise the API returns a single JSON object as before.
   */
  streamProgress?: boolean;
};

/** Stored JSON may be new package or legacy; treat as string map. */
export type LessonPlanResult = Record<string, string>;

/** URLs of FLUX-generated illustrations per teacher-package section (not sent to DeepSeek as text). */
export type SectionImageMap = Partial<Record<TeacherPackageSectionKey, string[]>>;

/** Serialized in `lesson_plan` JSON alongside section text keys. */
export const LESSON_PLAN_SECTION_IMAGES_META_KEY = "__sectionImageUrls" as const;

export function isLessonPlanMetaStorageKey(key: string): boolean {
  return key === LESSON_PLAN_SECTION_IMAGES_META_KEY || key.startsWith("__");
}

/** Split stored plan into text sections and optional FLUX image URLs. */
export function parseSectionImagesMeta(plan: LessonPlanResult): {
  planTextOnly: LessonPlanResult;
  sectionImages: SectionImageMap;
} {
  const planTextOnly = { ...plan };
  const raw = planTextOnly[LESSON_PLAN_SECTION_IMAGES_META_KEY];
  delete (planTextOnly as Record<string, unknown>)[LESSON_PLAN_SECTION_IMAGES_META_KEY];
  if (typeof raw !== "string" || !raw.trim()) {
    return { planTextOnly, sectionImages: {} };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { planTextOnly, sectionImages: {} };
    }
    return { planTextOnly, sectionImages: parsed as SectionImageMap };
  } catch {
    return { planTextOnly, sectionImages: {} };
  }
}

/** Attach serialized section image URLs for persistence (e.g. Supabase `lesson_plan`). */
export function mergeSectionImagesMeta(
  plan: LessonPlanResult,
  images: SectionImageMap | null | undefined,
): LessonPlanResult {
  if (!images || Object.keys(images).length === 0) {
    return plan;
  }
  return {
    ...plan,
    [LESSON_PLAN_SECTION_IMAGES_META_KEY]: JSON.stringify(images),
  };
}

export type SavedLessonPlan = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  learning_objectives: string;
  lesson_plan: LessonPlanResult;
  created_at: string;
  user_id: string;
  /** Added in schema migration; absent on older rows. */
  curriculum_type?: string;
  /** Optional national framework id; absent on older rows. */
  curriculum_framework?: string;
  chapter?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isTeacherPackagePlan(plan: Record<string, unknown>): boolean {
  return TEACHER_PACKAGE_SECTIONS.every((key) => isNonEmptyString(plan[key]));
}

/** Teacher-package sections that are present and non-empty (canonical order). */
export function getTeacherPackageKeysPresent(
  plan: Record<string, unknown>,
): TeacherPackageSectionKey[] {
  return TEACHER_PACKAGE_SECTIONS.filter((key) => isNonEmptyString(plan[key]));
}

/** True when the plan has at least one non-empty teacher-package section. */
export function hasTeacherPackageContent(plan: Record<string, unknown>): boolean {
  return getTeacherPackageKeysPresent(plan).length > 0;
}

/**
 * Concatenate present teacher-package sections as plain text for the Differentiated Worksheet Pack
 * (Way 1: send from generated lesson). Uses canonical section order; skips empty sections.
 */
export function buildDifferentiatedPackSourceText(plan: LessonPlanResult): string {
  const parts: string[] = [];
  for (const key of TEACHER_PACKAGE_SECTIONS) {
    const v = plan[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const label = getSectionTabLabel(key);
    parts.push(`## ${label}\n\n${v.trim()}`);
  }
  return parts.join("\n\n---\n\n");
}

/** Normalise and validate `sections` from the client; returns null if invalid or empty. */
export function normalizeGenerationSections(raw: unknown): TeacherPackageSectionKey[] | null {
  if (!Array.isArray(raw)) return null;
  const allowed = new Set<string>(TEACHER_PACKAGE_SECTIONS);
  const out: TeacherPackageSectionKey[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !allowed.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item as TeacherPackageSectionKey);
  }
  return out.length > 0 ? out : null;
}

/** Rough ETA copy for the generator UI based on how many sections are selected. */
export function getGenerationTimeEstimate(selectedCount: number): {
  tier: string;
  detail: string;
} {
  if (selectedCount <= 0) return { tier: "—", detail: "Select at least one item" };
  if (selectedCount <= 2) return { tier: "Fast", detail: "~30 sec" };
  if (selectedCount <= 4) return { tier: "Medium", detail: "~1 min" };
  return { tier: "Full package", detail: "~2–3 min" };
}

export function isLegacyLessonPlan(plan: Record<string, unknown>): boolean {
  return LEGACY_LESSON_PLAN_SECTIONS.every((key) => isNonEmptyString(plan[key]));
}

/** Order sections for UI and PPTX: prefer new package, then legacy, else arbitrary keys. */
export function getLessonPlanDisplayOrder(plan: LessonPlanResult): string[] {
  if (isLegacyLessonPlan(plan)) {
    return [...LEGACY_LESSON_PLAN_SECTIONS];
  }
  const teacherPresent = TEACHER_PACKAGE_SECTIONS.filter((key) => isNonEmptyString(plan[key]));
  if (teacherPresent.length > 0) {
    return teacherPresent;
  }
  return Object.keys(plan).filter(
    (key) => isNonEmptyString(plan[key]) && !isLessonPlanMetaStorageKey(key),
  );
}

/**
 * Joins every non-empty section the UI can display (same order as `getLessonPlanDisplayOrder`)
 * into one markdown-ish document. Used so PPT export matches on-screen content.
 */
export function buildCombinedTeacherPackageTextForPpt(plan: LessonPlanResult): string {
  const keys = getLessonPlanDisplayOrder(plan);
  const blocks: string[] = [];
  for (const key of keys) {
    if (isLessonPlanMetaStorageKey(key)) continue;
    const raw = plan[key];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    blocks.push(`## ${key}\n\n${text}`);
  }
  return blocks.join("\n\n").trim();
}

/** Text used to mine lesson phases for structured slides (prefers Full Lesson Plan when long enough). */
export function getPptSourceLessonText(plan: LessonPlanResult): string {
  const full =
    typeof plan["Full Lesson Plan"] === "string" ? plan["Full Lesson Plan"].trim() : "";
  if (full.length >= 200) return full;
  const merged = buildCombinedTeacherPackageTextForPpt(plan);
  return merged.length > full.length ? merged : full || merged;
}

/** PPT outline text for extraction; falls back to full lesson text when the outline section is short. */
export function getPptSourceSlideOutline(plan: LessonPlanResult): string {
  const ppt =
    typeof plan["PPT Slide Content"] === "string" ? plan["PPT Slide Content"].trim() : "";
  if (ppt.length >= 80) return ppt;
  const lesson = getPptSourceLessonText(plan);
  return lesson || ppt;
}
