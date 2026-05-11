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

/** Subject dropdown (lesson generator). */
export const SUBJECT_OPTIONS = [
  "Math",
  "Science",
  "English",
  "Arabic",
  "Islamic Studies",
  "Social Science",
  "ICT",
  "Art",
  "PE",
  "Other",
] as const;
export type SubjectOption = (typeof SUBJECT_OPTIONS)[number];

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

/** Max characters of upload-derived text sent into generation (truncated server-side). */
export const SOURCE_MATERIAL_MAX_CHARS = 80_000;

/** POST /api/lesson-plan body: class context plus which teacher-package sections to generate. */
export type LessonPlanGenerateBody = LessonPlanInput & {
  sections: TeacherPackageSectionKey[];
  /** Plain text from PDF extraction or image vision (optional). */
  sourceMaterial?: string;
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
