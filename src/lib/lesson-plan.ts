export const LESSON_PLAN_SECTIONS = [
  "Starter Activity",
  "Main Phase",
  "Transdisciplinary Connection",
  "Interdisciplinary Connection",
  "Extended Task",
  "CCL",
] as const;

export type LessonPlanSectionName = (typeof LESSON_PLAN_SECTIONS)[number];

export type LessonPlanInput = {
  subject: string;
  grade: string;
  topic: string;
  learningObjectives: string;
};

export type LessonPlanResult = Record<LessonPlanSectionName, string>;

export type LessonPlanPptxPayload = {
  subject: string;
  grade: string;
  topic: string;
  lessonPlan: LessonPlanResult;
};

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
