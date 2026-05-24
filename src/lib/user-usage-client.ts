import { supabase } from "@/lib/supabase";
import {
  DEFAULT_FREE_USAGE_INSERT,
  firstDayOfNextMonthUtc,
  logUsageSnapshot,
  toUsageSnapshot,
} from "@/lib/user-usage";

/** Client-side: create user_usage on first login/signup if missing (uses user session + RLS). */
export async function ensureUserUsageOnClient(userId: string): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("user_usage")
    .select("id, user_id, generations_used, generations_limit, plan_type, reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.warn("[user-usage] client read failed:", {
      message: readError.message,
      code: readError.code,
      details: readError.details,
      hint: readError.hint,
    });
    return;
  }

  if (existing) {
    const snapshot = toUsageSnapshot({
      user_id: userId,
      plan_type: existing.plan_type as "free",
      generations_used: existing.generations_used,
      generations_limit: existing.generations_limit,
      reset_date: existing.reset_date,
      created_at: "",
    });
    logUsageSnapshot("ensureUserUsageOnClient (existing)", snapshot);
    return;
  }

  const resetDate = firstDayOfNextMonthUtc();
  const { data: inserted, error: insertError } = await supabase
    .from("user_usage")
    .insert({
      user_id: userId,
      plan_type: DEFAULT_FREE_USAGE_INSERT.plan_type,
      generations_used: DEFAULT_FREE_USAGE_INSERT.generations_used,
      generations_limit: DEFAULT_FREE_USAGE_INSERT.generations_limit,
      reset_date: resetDate,
    })
    .select("generations_used, generations_limit, plan_type, reset_date")
    .single();

  if (insertError) {
    console.warn("[user-usage] client insert failed:", {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
    });
    return;
  }

  const snapshot = toUsageSnapshot({
    user_id: userId,
    plan_type: inserted.plan_type as "free",
    generations_used: inserted.generations_used,
    generations_limit: inserted.generations_limit,
    reset_date: inserted.reset_date,
    created_at: "",
  });
  logUsageSnapshot("ensureUserUsageOnClient (created)", snapshot);
}
