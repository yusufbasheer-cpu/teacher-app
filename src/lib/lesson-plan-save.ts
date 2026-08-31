import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergePptSlideImageUrlsIntoPlan,
  mergeSectionImagesMeta,
  type LessonPlanInput,
  type LessonPlanResult,
  type SectionImageMap,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
} from "@/lib/lesson-plan";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";

export type LessonPlanSaveForm = Pick<
  LessonPlanInput,
  "curriculumType" | "curriculumFramework" | "grade" | "subject" | "chapter" | "topic" | "learningObjectives"
>;

export type LessonPlanSaveRequest = {
  activePlanId?: string | null;
  form: LessonPlanSaveForm;
  lessonPlan: LessonPlanResult;
  sectionImages?: SectionImageMap | null;
  pptSlideImageUrls?: (string | null)[] | null;
};

export type LessonPlanSaveResult =
  | { action: "inserted"; id: string }
  | { action: "updated"; id: string };

export function buildLessonPlanSavePayload(request: LessonPlanSaveRequest & { userId: string }) {
  const mergedPlan = mergePptSlideImageUrlsIntoPlan(
    mergeSectionImagesMeta(request.lessonPlan, request.sectionImages),
    request.pptSlideImageUrls,
  );

  return {
    user_id: request.userId,
    curriculum_type: request.form.curriculumType,
    curriculum_framework: request.form.curriculumFramework.trim() || "",
    subject: request.form.subject,
    grade: request.form.grade,
    chapter: request.form.chapter.trim(),
    topic: request.form.topic.trim(),
    learning_objectives: request.form.learningObjectives,
    lesson_plan: mergedPlan,
  };
}

export function isLessonPlanSaveRequest(value: unknown): value is LessonPlanSaveRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const form = v.form as Record<string, unknown> | undefined;
  const lessonPlan = v.lessonPlan;

  if (!form || typeof form !== "object" || Array.isArray(form)) return false;
  if (!lessonPlan || typeof lessonPlan !== "object" || Array.isArray(lessonPlan)) return false;
  if (typeof form.curriculumType !== "string") return false;
  if (typeof form.curriculumFramework !== "string") return false;
  if (typeof form.grade !== "string") return false;
  if (typeof form.subject !== "string") return false;
  if (typeof form.chapter !== "string") return false;
  if (typeof form.topic !== "string") return false;
  if (typeof form.learningObjectives !== "string") return false;
  if (!isValidCurriculumType(form.curriculumType.trim())) return false;
  if (!isValidGradeYear(form.grade.trim())) return false;
  if (!isValidSubjectOption(form.subject.trim())) return false;
  if (!isValidCurriculumFramework(form.curriculumFramework)) return false;
  return true;
}

export async function saveLessonPlanRecord(
  supabase: SupabaseClient,
  userId: string,
  request: LessonPlanSaveRequest,
): Promise<LessonPlanSaveResult> {
  const payload = buildLessonPlanSavePayload({ ...request, userId });

  if (request.activePlanId) {
    const { error } = await supabase
      .from("lesson_plans")
      .update(payload)
      .eq("id", request.activePlanId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { action: "updated", id: request.activePlanId };
  }

  const { data, error } = await supabase
    .from("lesson_plans")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id?: string } | null)?.id;
  if (!id) {
    throw new Error("Lesson plan insert succeeded but no id was returned.");
  }
  return { action: "inserted", id };
}

export function isValidLessonPlanSaveRequestBody(body: unknown): body is LessonPlanSaveRequest {
  return isLessonPlanSaveRequest(body);
}
