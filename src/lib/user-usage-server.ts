import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_FREE_USAGE_INSERT,
  firstDayOfNextMonthUtc,
  GENERATION_LIMIT_ERROR_CODE,
  getGenerationsLimitForPlan,
  getUpgradePitch,
  isPlanType,
  logUsageSnapshot,
  needsMonthlyReset,
  normalizeUsageRow,
  toUsageSnapshot,
  type PlanType,
  type UserUsageRow,
  type UserUsageSnapshot,
} from "@/lib/user-usage";

export function getSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}

export function getBearerToken(req: Request): string | null {
  return req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
}

async function insertDefaultUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageRow | null> {
  const resetDate = firstDayOfNextMonthUtc();
  const { data, error } = await supabase
    .from("user_usage")
    .insert({
      user_id: userId,
      plan_type: DEFAULT_FREE_USAGE_INSERT.plan_type,
      generations_used: DEFAULT_FREE_USAGE_INSERT.generations_used,
      generations_limit: DEFAULT_FREE_USAGE_INSERT.generations_limit,
      reset_date: resetDate,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[user-usage] insert default failed:", error.message, error.code);
    return null;
  }

  console.log("[user-usage] created new user_usage row", {
    user_id: userId,
    generations_used: 0,
    generations_limit: 3,
    reset_date: resetDate,
  });

  return normalizeUsageRow(data as UserUsageRow);
}

async function applyMonthlyResetIfNeeded(
  supabase: SupabaseClient,
  row: UserUsageRow,
): Promise<UserUsageRow> {
  if (!needsMonthlyReset(row.reset_date)) return normalizeUsageRow(row);

  const plan = isPlanType(row.plan_type) ? row.plan_type : "free";
  const limit = getGenerationsLimitForPlan(plan);
  const generations_limit = limit ?? -1;
  const nextReset = firstDayOfNextMonthUtc();

  const { data, error } = await supabase
    .from("user_usage")
    .update({
      generations_used: 0,
      reset_date: nextReset,
      generations_limit,
    })
    .eq("user_id", row.user_id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[user-usage] monthly reset failed:", error?.message);
    return normalizeUsageRow({
      ...row,
      generations_used: 0,
      reset_date: nextReset,
      generations_limit,
    });
  }

  return normalizeUsageRow(data as UserUsageRow);
}

/**
 * Ensure a user_usage row exists (create on first login/signup), apply monthly reset, normalize.
 */
export async function ensureUserUsageRecord(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageRow | null> {
  const { data, error } = await supabase
    .from("user_usage")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[user-usage] select failed:", error.message);
    return null;
  }

  let row = data as UserUsageRow | null;
  if (!row) {
    row = await insertDefaultUsage(supabase, userId);
    if (!row) return null;
  }

  row = await applyMonthlyResetIfNeeded(supabase, row);
  return row;
}

/** Fetch usage row, create if missing, reset on new month. */
export async function getOrCreateUserUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageSnapshot | null> {
  const row = await ensureUserUsageRecord(supabase, userId);
  if (!row) return null;

  const snapshot = toUsageSnapshot(row);
  logUsageSnapshot("getOrCreateUserUsage", snapshot);
  return snapshot;
}

export type GenerationGateResult =
  | { ok: true; usage: UserUsageSnapshot }
  | { ok: false; status: number; code: string; message: string; usage: UserUsageSnapshot };

export async function assertCanGenerate(
  supabase: SupabaseClient,
  userId: string,
): Promise<GenerationGateResult> {
  const usage = await getOrCreateUserUsage(supabase, userId);
  if (!usage) {
    return {
      ok: false,
      status: 500,
      code: "USAGE_CHECK_FAILED",
      message: "Could not verify your generation allowance.",
      usage: {
        planType: "free",
        generationsUsed: 0,
        generationsLimit: 3,
        unlimited: false,
        canGenerate: true,
        resetDate: firstDayOfNextMonthUtc(),
      },
    };
  }

  if (!usage.canGenerate) {
    const limit = usage.generationsLimit ?? 0;
    return {
      ok: false,
      status: 403,
      code: GENERATION_LIMIT_ERROR_CODE,
      message: `You have used all ${limit} generations for this month.`,
      usage,
    };
  }

  return { ok: true, usage };
}

export async function incrementGenerationsUsed(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageSnapshot | null> {
  const row = await ensureUserUsageRecord(supabase, userId);
  if (!row) return null;

  const snapshot = toUsageSnapshot(row);
  if (snapshot.unlimited) return snapshot;

  const { error } = await supabase
    .from("user_usage")
    .update({ generations_used: row.generations_used + 1 })
    .eq("user_id", userId);

  if (error) {
    console.error("[user-usage] increment failed:", error.message);
    return snapshot;
  }

  return getOrCreateUserUsage(supabase, userId);
}

export async function authenticateRequest(
  req: Request,
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; status: number; message: string }
> {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "Unauthorized. Please log in." };
  }

  const supabase = getSupabaseForUser(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, message: "Invalid session. Please log in again." };
  }

  return { ok: true, supabase, userId: user.id };
}
