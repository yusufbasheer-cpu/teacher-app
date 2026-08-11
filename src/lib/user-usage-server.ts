import * as Sentry from "@sentry/nextjs";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { checkRateLimit, HOUR_MS } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";
import type { PlanId } from "@/lib/plans";
import {
  defaultFreeUsageSnapshot,
  GENERATION_LIMIT_ERROR_CODE,
  logGenerationCounted,
  logUsageSnapshot,
  normalizeUsageRow,
  toUsageSnapshot,
  type UserUsageRow,
  type UserUsageSnapshot,
} from "@/lib/user-usage";

const USER_USAGE_TABLE = "user_usage";

/** Server client scoped to the caller's JWT so RLS sees auth.uid() = user_id. */
export function getSupabaseForUser(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export function getBearerToken(req: Request): string | null {
  return req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
}

const DEBUG = process.env.DEBUG === "true";

function logSupabaseError(
  operation: string,
  error: PostgrestError | null,
  extra?: Record<string, unknown>,
): void {
  if (!error) return;
  logExactSupabaseError(operation, error, extra);
}

/** Log the exact PostgREST/Supabase error when an update or RPC fails. */
export function logExactSupabaseError(
  operation: string,
  error: PostgrestError,
  extra?: Record<string, unknown>,
): void {
  console.error(`[user-usage] Supabase error (${operation}): ${error.message}`);
  console.error("[user-usage] Exact Supabase error payload:", {
    table: USER_USAGE_TABLE,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    ...extra,
  });
}

type UsageRpcPayload = {
  outcome: string;
  user_id: string;
  plan_type: string;
  generations_used: number;
  generations_limit: number;
  reset_date: string;
  created_at: string;
};

async function callUsageRpc(
  supabase: SupabaseClient,
  fn: "ensure_user_usage" | "consume_user_generation",
): Promise<{ ok: true; outcome: string; row: UserUsageRow } | { ok: false; error: PostgrestError }> {
  const { data, error } = await supabase.rpc(fn);
  if (error) return { ok: false, error };

  const payload = (Array.isArray(data) ? data[0] : data) as UsageRpcPayload | null;
  if (!payload) {
    return {
      ok: false,
      error: {
        message: `${fn} returned no payload`,
        code: "EMPTY_RPC_RESULT",
        details: "",
        hint: "",
        name: "PostgrestError",
      } as PostgrestError,
    };
  }

  const row = normalizeUsageRow({
    user_id: payload.user_id,
    plan_type: payload.plan_type as UserUsageRow["plan_type"],
    generations_used: payload.generations_used,
    generations_limit: payload.generations_limit,
    reset_date: payload.reset_date,
    created_at: payload.created_at,
  });

  return { ok: true, outcome: payload.outcome, row };
}

/**
 * Ensure a user_usage row exists (create on first login/signup), apply monthly
 * reset, normalize. Delegates to the ensure_user_usage() security-definer RPC
 * (supabase/migrations/20260728120000_usage_gate_functions.sql) so the row is
 * created and reset atomically under a row lock, rather than the previous
 * select-then-insert-then-update sequence run over the user's own JWT client.
 */
export async function ensureUserUsageRecord(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserUsageRow | null> {
  try {
    const result = await callUsageRpc(supabase, "ensure_user_usage");
    if (!result.ok) {
      logSupabaseError("rpc ensure_user_usage", result.error, { userId });
      return null;
    }
    return result.row;
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

/**
 * The caller's plan, for entitlement checks that must run BEFORE
 * reserveGeneration() (so a rejected request never consumes a slot). Fails
 * closed to "free" on any lookup failure — unlike reserveGeneration's
 * fail-open break-glass for pure quota counting, a plan lookup failure here
 * should never accidentally unlock a Pro-only feature.
 */
export async function getCallerPlanType(supabase: SupabaseClient, userId: string): Promise<PlanId> {
  const usage = await getOrCreateUserUsage(supabase, userId);
  return usage?.planType ?? "free";
}

/** A held generation slot. Pass to refundGeneration() if the paid AI call afterward fails. */
export type GenerationReservation = { userId: string; resetDate: string };

/** Returned when the usage gate itself couldn't be checked (RPC/DB failure). See handleGateFailure. */
export const USAGE_CHECK_UNAVAILABLE_CODE = "USAGE_CHECK_UNAVAILABLE";

export type GenerationGateResult =
  | { ok: true; usage: UserUsageSnapshot; reservation: GenerationReservation | null; checkSkipped?: boolean }
  | {
      ok: false;
      status: number;
      code: typeof GENERATION_LIMIT_ERROR_CODE | typeof USAGE_CHECK_UNAVAILABLE_CODE;
      message: string;
      usage: UserUsageSnapshot;
    };

// Break-glass: if the usage gate itself starts failing (RPC missing/broken,
// outage), set USAGE_GATE_FAIL_OPEN=true in the environment and redeploy to
// fall back to unmetered generation rather than blocking every user. Default
// is fail-closed — see the reasoning in the Phase 4 commit message.
const FAIL_OPEN = process.env.USAGE_GATE_FAIL_OPEN === "true";

/**
 * Reports a usage-gate failure loudly (console + Sentry + a rate-limited
 * alert email) and returns either a fail-open allowance or a fail-closed 503,
 * depending on the USAGE_GATE_FAIL_OPEN break-glass env var.
 */
function handleGateFailure(userId: string, error: PostgrestError): GenerationGateResult {
  console.error("[usage-gate] USAGE_GATE_FAILED", {
    userId,
    code: error.code,
    message: error.message,
    hint: error.hint,
    failOpen: FAIL_OPEN,
  });

  Sentry.captureException(new Error(`usage gate failed: ${error.message}`), {
    tags: { area: "usage_gate", pgcode: error.code ?? "unknown" },
  });

  // Reuses the existing in-memory rate limiter purely to throttle the alert
  // email to once per hour — not a new dependency.
  if (checkRateLimit("usage_gate_alert", 1, HOUR_MS).ok) {
    void sendEmail({
      to: "info@layah.in",
      subject: "Layah ALERT — usage gate failing",
      text: `consume_user_generation/ensure_user_usage failed.\ncode=${error.code}\nmessage=${error.message}\nfailOpen=${FAIL_OPEN}\ntime=${new Date().toISOString()}`,
    });
  }

  if (FAIL_OPEN) {
    return {
      ok: true,
      usage: defaultFreeUsageSnapshot(),
      reservation: null,
      checkSkipped: true,
    };
  }

  return {
    ok: false,
    status: 503,
    code: USAGE_CHECK_UNAVAILABLE_CODE,
    message: "We could not check your plan just now. Please try again in a moment.",
    usage: defaultFreeUsageSnapshot(),
  };
}

/**
 * Atomically reserve one generation BEFORE spending money on DeepSeek/fal.
 * Replaces the old check-then-act assertCanGenerate + incrementGenerationsUsed
 * pair: reset, limit check, and increment now happen as one unit under a row
 * lock inside the consume_user_generation() RPC
 * (supabase/migrations/20260728120000_usage_gate_functions.sql), so
 * concurrent requests can no longer all pass the check before any of them
 * increments.
 *
 * On success, the caller MUST either use the generation and discard
 * `reservation`, or call refundGeneration(reservation) if the paid AI call
 * fails — mirroring today's "a failed generation costs nothing" behaviour,
 * just moved to before the spend instead of after.
 *
 * Fails CLOSED (503) on any RPC/DB error rather than allowing unmetered
 * generation, unless USAGE_GATE_FAIL_OPEN=true is set as a break-glass.
 */
export async function reserveGeneration(
  supabase: SupabaseClient,
  userId: string,
): Promise<GenerationGateResult> {
  try {
    const result = await callUsageRpc(supabase, "consume_user_generation");

    if (!result.ok) {
      return handleGateFailure(userId, result.error);
    }

    const usage = toUsageSnapshot(result.row);

    if (result.outcome === "limit_reached") {
      const limit = usage.generationsLimit ?? 0;
      DEBUG && console.log("[usage-gate] limit reached", {
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

    const reservation: GenerationReservation | null =
      result.outcome === "incremented" ? { userId, resetDate: result.row.reset_date } : null;

    if (reservation) {
      logGenerationCounted(usage);
    }
    logUsageSnapshot("reserveGeneration", usage);

    return { ok: true, usage, reservation };
  } catch (err) {
    console.error("[usage-gate] reserveGeneration unexpected error", {
      userId,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    return handleGateFailure(userId, {
      message: err instanceof Error ? err.message : String(err),
      code: "UNEXPECTED",
      details: "",
      hint: "",
      name: "PostgrestError",
    } as PostgrestError);
  }
}

/**
 * Give a reserved generation back after the paid AI call that followed it
 * failed. No-op for unlimited plans (reservation is null). Uses the
 * service-role client — refund_user_generation() is granted to service_role
 * only, precisely so a user can never call it themselves to zero out their
 * own counter.
 */
export async function refundGeneration(reservation: GenerationReservation | null): Promise<void> {
  if (!reservation) return;

  const admin = getSupabaseServiceRole();
  if (!admin) {
    console.error(
      "[usage-gate] REFUND SKIPPED — SUPABASE_SERVICE_ROLE_KEY not set, user was charged a generation for a failed request",
      reservation,
    );
    return;
  }

  const { data, error } = await admin.rpc("refund_user_generation", {
    p_user_id: reservation.userId,
    p_reset_date: reservation.resetDate,
  });

  if (error) {
    console.error("[usage-gate] refund failed", {
      ...reservation,
      message: error.message,
      code: error.code,
    });
    return;
  }

  const outcome = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | null;
  console.log("[usage-gate] refund", { userId: reservation.userId, outcome: outcome?.outcome });
}

export async function authenticateRequest(
  req: Request,
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string; accessToken: string }
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
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.warn("[user-usage] authenticateRequest: invalid or expired session", {
      authError: error?.message ?? null,
      hasUser: Boolean(user),
    });
    return { ok: false, status: 401, message: "Invalid session. Please log in again." };
  }

  DEBUG && console.log("[user-usage] authenticateRequest: ok", {
    userId: user.id,
    auth_uid_matches: user.id,
  });
  return { ok: true, supabase, userId: user.id, accessToken: token };
}
