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

export type LessonPlanInput = {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
};

/** Stored JSON may be new package or legacy; treat as string map. */
export type LessonPlanResult = Record<string, string>;

export type SavedLessonPlan = {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  learning_objectives: string;
  lesson_plan: LessonPlanResult;
  created_at: string;
  user_id: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isTeacherPackagePlan(plan: Record<string, unknown>): boolean {
  return TEACHER_PACKAGE_SECTIONS.every((key) => isNonEmptyString(plan[key]));
}

export function isLegacyLessonPlan(plan: Record<string, unknown>): boolean {
  return LEGACY_LESSON_PLAN_SECTIONS.every((key) => isNonEmptyString(plan[key]));
}

/** Order sections for UI and PPTX: prefer new package, then legacy, else arbitrary keys. */
export function getLessonPlanDisplayOrder(plan: LessonPlanResult): string[] {
  if (isTeacherPackagePlan(plan)) {
    return [...TEACHER_PACKAGE_SECTIONS];
  }
  if (isLegacyLessonPlan(plan)) {
    return [...LEGACY_LESSON_PLAN_SECTIONS];
  }
  return Object.keys(plan).filter((key) => isNonEmptyString(plan[key]));
}
