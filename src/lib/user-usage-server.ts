import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import {
  DEFAULT_FREE_USAGE_INSERT,
  defaultFreeUsageSnapshot,
  firstDayOfNextMonthUtc,
  GENERATION_LIMIT_ERROR_CODE,
  getGenerationsLimitForPlan,
  isPlanType,
  logGenerationCounted,
  logUsageSnapshot,
  needsMonthlyReset,
  normalizeUsageRow,
  toUsageSnapshot,
  type UserUsageRow,
  type UserUsageSnapshot,
} from "@/lib/user-usage";

const USER_USAGE_TABLE = "user_usage";

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

function logSupabaseError(
  operation: string,
  error: PostgrestError | null,
  extra?: Record<string, unknown>,
): void {
  if (!error) return;
  console.error(`[user-usage] ${operation} failed`, {
    table: USER_USAGE_TABLE,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    ...extra,
  });
}

async function insertDefaultUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageRow | null> {
  const resetDate = firstDayOfNextMonthUtc();
  const { data, error } = await supabase
    .from(USER_USAGE_TABLE)
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
    logSupabaseError("insert default user_usage", error, { userId });

    if (error.code === "23505") {
      const { data: existing, error: retryError } = await supabase
        .from(USER_USAGE_TABLE)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (retryError) {
        logSupabaseError("select after insert conflict", retryError, { userId });
        return null;
      }
      if (existing) return normalizeUsageRow(existing as UserUsageRow);
    }

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
    .from(USER_USAGE_TABLE)
    .update({
      generations_used: 0,
      reset_date: nextReset,
      generations_limit,
    })
    .eq("user_id", row.user_id)
    .select("*")
    .single();

  if (error || !data) {
    logSupabaseError("monthly reset update", error, { userId: row.user_id });
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
  try {
    const { data, error } = await supabase
      .from(USER_USAGE_TABLE)
      .select("id, user_id, plan_type, generations_used, generations_limit, reset_date, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logSupabaseError("select user_usage by user_id", error, { userId });
      return null;
    }

    let row = data as UserUsageRow | null;
    if (!row) {
      row = await insertDefaultUsage(supabase, userId);
      if (!row) return null;
    }

    row = await applyMonthlyResetIfNeeded(supabase, row);
    return row;
  } catch (err) {
    console.error("[user-usage] ensureUserUsageRecord unexpected error", {
      userId,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    return null;
  }
}

/** Fetch usage row, create if missing, reset on new month. */
export async function getOrCreateUserUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageSnapshot | null> {
  const row = await ensureUserUsageRecord(supabase, userId);
  if (!row) {
    console.warn("[user-usage] getOrCreateUserUsage: no row available", { userId });
    return null;
  }

  const snapshot = toUsageSnapshot(row);
  logUsageSnapshot("getOrCreateUserUsage", snapshot);
  return snapshot;
}

export type GenerationGateResult =
  | { ok: true; usage: UserUsageSnapshot; checkSkipped?: boolean }
  | {
      ok: false;
      status: number;
      code: typeof GENERATION_LIMIT_ERROR_CODE;
      message: string;
      usage: UserUsageSnapshot;
    };

/**
 * Verify generation allowance after auth. On any DB/check failure, fail-open (allow generation).
 * Only blocks when generations_used >= generations_limit.
 */
export async function assertCanGenerate(
  supabase: SupabaseClient,
  userId: string,
): Promise<GenerationGateResult> {
  try {
    const usage = await getOrCreateUserUsage(supabase, userId);

    if (!usage) {
      console.warn(
        "[user-usage] assertCanGenerate: allowance check failed — allowing generation (fail-open)",
        { userId },
      );
      return { ok: true, usage: defaultFreeUsageSnapshot(), checkSkipped: true };
    }

    if (!usage.canGenerate) {
      const limit = usage.generationsLimit ?? 0;
      console.log("[user-usage] assertCanGenerate: limit reached", {
        userId,
        generations_used: usage.generationsUsed,
        generations_limit: limit,
      });
      return {
        ok: false,
        status: 403,
        code: GENERATION_LIMIT_ERROR_CODE,
        message: `You have used all ${limit} generations for this month.`,
        usage,
      };
    }

    return { ok: true, usage };
  } catch (err) {
    console.error(
      "[user-usage] assertCanGenerate: unexpected error — allowing generation (fail-open)",
      {
        userId,
        error:
          err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      },
    );
    return { ok: true, usage: defaultFreeUsageSnapshot(), checkSkipped: true };
  }
}

async function verifyAuthenticatedUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; authUserId: string } | { ok: false; reason: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      reason: error?.message ?? "No authenticated user on Supabase client",
    };
  }

  if (user.id !== userId) {
    return {
      ok: false,
      reason: `user_id mismatch: JWT user ${user.id} !== requested ${userId}`,
    };
  }

  return { ok: true, authUserId: user.id };
}

async function runUsageIncrementUpdate(
  client: SupabaseClient,
  authUserId: string,
  nextUsed: number,
  label: string,
): Promise<{ row: UserUsageRow | null; error: PostgrestError | null }> {
  console.log(`[user-usage] BEFORE Supabase update (${label})`, {
    table: USER_USAGE_TABLE,
    user_id: authUserId,
    generations_used: nextUsed,
  });

  const { data, error } = await client
    .from(USER_USAGE_TABLE)
    .update({ generations_used: nextUsed })
    .eq("user_id", authUserId)
    .select("id, user_id, plan_type, generations_used, generations_limit, reset_date, created_at")
    .maybeSingle();

  console.log(`[user-usage] AFTER Supabase update (${label})`, {
    user_id: authUserId,
    success: !error && Boolean(data),
    generations_used: data?.generations_used ?? null,
    error: error
      ? { message: error.message, code: error.code, details: error.details, hint: error.hint }
      : null,
  });

  return { row: data ? normalizeUsageRow(data as UserUsageRow) : null, error };
}

/**
 * Increment generations_used by 1 after a successful generation. Returns updated usage snapshot.
 */
export async function incrementGenerationsUsed(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageSnapshot | null> {
  try {
    const authCheck = await verifyAuthenticatedUserId(supabase, userId);
    if (!authCheck.ok) {
      console.error("[user-usage] incrementGenerationsUsed: auth check failed", {
        userId,
        reason: authCheck.reason,
      });
      return null;
    }

    const authUserId = authCheck.authUserId;
    console.log("[user-usage] incrementGenerationsUsed: auth ok", {
      user_id: authUserId,
      idsMatch: authUserId === userId,
    });

    const { data: rpcData, error: rpcError } = await supabase.rpc("increment_user_generations");
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (!rpcError && rpcRow) {
      const row = normalizeUsageRow(rpcRow as UserUsageRow);
      if (row.user_id !== authUserId) {
        console.error("[user-usage] RPC returned wrong user_id", {
          expected: authUserId,
          got: row.user_id,
        });
      } else {
        const snapshot = toUsageSnapshot(row);
        logGenerationCounted(snapshot);
        logUsageSnapshot("incrementGenerationsUsed (rpc)", snapshot);
        return snapshot;
      }
    }

    if (rpcError) {
      logSupabaseError("rpc increment_user_generations", rpcError, { userId: authUserId });
    }

    const row = await ensureUserUsageRecord(supabase, authUserId);
    if (!row) {
      console.warn("[user-usage] incrementGenerationsUsed: skipped (no row)", {
        userId: authUserId,
      });
      return null;
    }

    const before = toUsageSnapshot(row);
    if (before.unlimited) {
      logGenerationCounted(before);
      return before;
    }

    const currentUsed = Math.max(0, Number(row.generations_used) || 0);
    const nextUsed = currentUsed + 1;

    let { row: updatedRow, error: updateError } = await runUsageIncrementUpdate(
      supabase,
      authUserId,
      nextUsed,
      "user-jwt",
    );

    if (updateError || !updatedRow) {
      const admin = getSupabaseServiceRole();
      if (admin) {
        console.warn("[user-usage] retrying increment with service role after user JWT update failed");
        const adminResult = await runUsageIncrementUpdate(admin, authUserId, nextUsed, "service-role");
        updatedRow = adminResult.row;
        updateError = adminResult.error;
      } else {
        console.warn(
          "[user-usage] SUPABASE_SERVICE_ROLE_KEY not set — cannot retry increment with service role",
        );
      }
    }

    if (updateError || !updatedRow) {
      if (updateError) {
        console.error("[user-usage] increment update failed — exact error:", updateError.message, {
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
        });
      }
      return before;
    }

    const snapshot = toUsageSnapshot(updatedRow);
    logGenerationCounted(snapshot);
    logUsageSnapshot("incrementGenerationsUsed (update)", snapshot);
    return snapshot;
  } catch (err) {
    console.error("[user-usage] incrementGenerationsUsed unexpected error", {
      userId,
      error: err instanceof Error ? { name: err.name, message: err.message } : err,
    });
    return null;
  }
}

/** Call only after generation succeeded; attaches usage to API payload when increment succeeds. */
export async function recordSuccessfulGeneration(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageSnapshot | null> {
  return incrementGenerationsUsed(supabase, userId);
}

export async function authenticateRequest(
  req: Request,
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; status: number; message: string }
> {
  const token = getBearerToken(req);
  if (!token) {
    console.warn("[user-usage] authenticateRequest: missing Authorization bearer token");
    return { ok: false, status: 401, message: "Unauthorized. Please log in." };
  }

  const supabase = getSupabaseForUser(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.warn("[user-usage] authenticateRequest: invalid or expired session", {
      authError: error?.message ?? null,
      hasUser: Boolean(user),
    });
    return { ok: false, status: 401, message: "Invalid session. Please log in again." };
  }

  console.log("[user-usage] authenticateRequest: ok", { userId: user.id });
  return { ok: true, supabase, userId: user.id };
}
