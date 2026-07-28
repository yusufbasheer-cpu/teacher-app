import { supabase } from "@/lib/supabase";
import { logUsageSnapshot, normalizeUsageRow, toUsageSnapshot, type UserUsageRow } from "@/lib/user-usage";

type EnsureUsageRpcPayload = {
  outcome: string;
  user_id: string;
  plan_type: string;
  generations_used: number;
  generations_limit: number;
  reset_date: string;
  created_at: string;
};

/**
 * Client-side: create user_usage on first login/signup if missing, via the
 * ensure_user_usage() security-definer RPC (see
 * supabase/migrations/20260728120000_usage_gate_functions.sql). Creation and
 * the monthly reset both happen atomically inside the RPC under a row lock —
 * this used to do a raw select-then-insert directly against the table, which
 * only worked because `authenticated` had a direct INSERT grant on
 * user_usage. That grant is what let any logged-in user PATCH their own
 * plan_type via the public anon key, so it was revoked (see
 * supabase/migrations/20260728123000_user_usage_lockdown.sql); this RPC is
 * the only way to create a row now.
 */
export async function ensureUserUsageOnClient(): Promise<void> {
  const { data, error } = await supabase.rpc("ensure_user_usage");

  if (error) {
    console.warn("[user-usage] client ensure_user_usage RPC failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return;
  }

  const payload = (Array.isArray(data) ? data[0] : data) as EnsureUsageRpcPayload | null;
  if (!payload) return;

  const row: UserUsageRow = {
    user_id: payload.user_id,
    plan_type: payload.plan_type as UserUsageRow["plan_type"],
    generations_used: payload.generations_used,
    generations_limit: payload.generations_limit,
    reset_date: payload.reset_date,
    created_at: payload.created_at,
  };

  const snapshot = toUsageSnapshot(normalizeUsageRow(row));
  logUsageSnapshot(`ensureUserUsageOnClient (${payload.outcome})`, snapshot);
}
