import { getSupabaseServiceRole } from "@/lib/supabase-admin";

export type GenerationType = "lesson_plan" | "question_paper" | "differentiated_pack";
export type GenerationStatus = "success" | "failed";

/**
 * Append-only log of individual generation attempts, backing "generations
 * over time" / "feature usage breakdown" / "avg per user" analytics —
 * user_usage.generations_used is a rolling aggregate and can't reconstruct
 * a timeline. Best-effort: never throws, never blocks the actual response.
 */
export async function logGenerationEvent(params: {
  userId: string;
  generationType: GenerationType;
  status: GenerationStatus;
  planType: string;
  /** Defaults to true. Set false for generation types not gated by reserveGeneration(). */
  metered?: boolean;
  errorMessage?: string;
  durationMs?: number;
}): Promise<void> {
  try {
    const admin = getSupabaseServiceRole();
    if (!admin) return;
    const { error } = await admin.from("generation_events").insert({
      user_id: params.userId,
      generation_type: params.generationType,
      status: params.status,
      plan_type: params.planType,
      metered: params.metered ?? true,
      error_message: params.errorMessage?.slice(0, 2000) ?? null,
      duration_ms: params.durationMs ?? null,
    });
    if (error) {
      console.error("[generation-events] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[generation-events] unexpected error:", err instanceof Error ? err.message : err);
  }
}
