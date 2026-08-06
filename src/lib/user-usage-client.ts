import { supabase } from "@/lib/supabase";
import { logUsageSnapshot, toUsageSnapshot } from "@/lib/user-usage";

/**
 * Client-side: create user_usage on first login/signup if missing, and apply the monthly reset
 * if due. The client has no raw INSERT/UPDATE grant on user_usage (see the 20260806150000
 * lockdown migration) -- this calls the SECURITY DEFINER RPC that does both, scoped to auth.uid().
 */
export async function ensureUserUsageOnClient(userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("ensure_own_user_usage");

  if (error || !data) {
    console.warn("[user-usage] ensure_own_user_usage RPC failed:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return;
  }

  const row = data as {
    plan_type: string;
    generations_used: number;
    generations_limit: number;
    reset_date: string;
  };

  const snapshot = toUsageSnapshot({
    user_id: userId,
    plan_type: row.plan_type as "free",
    generations_used: row.generations_used,
    generations_limit: row.generations_limit,
    reset_date: row.reset_date,
    created_at: "",
  });
  logUsageSnapshot("ensureUserUsageOnClient (rpc)", snapshot);
}
