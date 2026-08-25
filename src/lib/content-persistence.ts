import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export type ModeratableContentType = "lesson_plan" | "question_paper" | "differentiated_pack";

export const CONTENT_TABLE_BY_TYPE: Record<ModeratableContentType, string> = {
  lesson_plan: "saved_lessons",
  question_paper: "question_paper_generations",
  differentiated_pack: "differentiated_pack_generations",
};

export function isModeratableContentType(value: string): value is ModeratableContentType {
  return value === "lesson_plan" || value === "question_paper" || value === "differentiated_pack";
}

/**
 * Server-side persistence for question papers and differentiated packs, so
 * both are moderatable (src/app/api/super-admin/content) regardless of
 * whether the teacher chooses to save/download — unlike lesson plans
 * (saved_lessons), which the browser writes client-side after generation.
 * Best-effort: never throws, never blocks the actual generation response.
 */
export async function saveQuestionPaperGeneration(params: {
  userId: string;
  subject?: string;
  grade?: string;
  topic?: string;
  curriculum?: string;
  content: unknown;
}): Promise<void> {
  try {
    const admin = getSupabaseServiceRole();
    if (!admin) return;
    const { error } = await admin.from("question_paper_generations").insert({
      user_id: params.userId,
      subject: params.subject ?? null,
      grade: params.grade ?? null,
      topic: params.topic ?? null,
      curriculum: params.curriculum ?? null,
      content: params.content,
    });
    if (error) {
      console.error("[content-persistence] question_paper insert failed:", error.message);
    }
  } catch (err) {
    console.error("[content-persistence] unexpected error:", err instanceof Error ? err.message : err);
  }
}

export async function saveDifferentiatedPackGeneration(params: {
  userId: string;
  subject?: string;
  grade?: string;
  topic?: string;
  curriculum?: string;
  content: unknown;
}): Promise<void> {
  try {
    const admin = getSupabaseServiceRole();
    if (!admin) return;
    const { error } = await admin.from("differentiated_pack_generations").insert({
      user_id: params.userId,
      subject: params.subject ?? null,
      grade: params.grade ?? null,
      topic: params.topic ?? null,
      curriculum: params.curriculum ?? null,
      content: params.content,
    });
    if (error) {
      console.error("[content-persistence] differentiated_pack insert failed:", error.message);
    }
  } catch (err) {
    console.error("[content-persistence] unexpected error:", err instanceof Error ? err.message : err);
  }
}
