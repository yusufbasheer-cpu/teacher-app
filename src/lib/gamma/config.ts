/**
 * Gamma experiment configuration. Isolated from legacy PPT code: nothing here is imported by the
 * legacy renderer, and legacy mode never reads GAMMA_API_KEY.
 */

export type PptProvider = "legacy" | "gamma";

export type GammaErrorCode =
  | "missing_credentials"
  | "invalid_credentials"
  | "insufficient_credits"
  | "bad_request"
  | "rate_limited"
  | "request_timeout"
  | "poll_timeout"
  | "deadline_exceeded"
  | "submission_unknown"
  | "generation_failed"
  | "generation_in_progress"
  | "api_error"
  | "download_rejected"
  | "invalid_export"
  | "export_host_unconfigured"
  | "store_unavailable"
  | "user_rate_limited"
  | "budget_exceeded"
  | "duplicate_in_flight";

export class GammaError extends Error {
  constructor(
    readonly code: GammaErrorCode,
    message: string,
    readonly extra: { status?: number; generationId?: string } = {},
  ) {
    super(message);
    this.name = "GammaError";
  }
}

type Env = Record<string, string | undefined>;

function csv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Environment names that can never run Gamma, regardless of the allowlist. */
const FORBIDDEN_ENVIRONMENTS = new Set(["production", "prod", "live"]);
/** The production Supabase project. Gamma (and its ledger, which uses the service-role key) can never run against it. */
const PRODUCTION_SUPABASE_REF = "jbwevzvtloahjoamwnjt";

function supabaseRef(env: Env): string | undefined {
  return /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "")?.[1]?.toLowerCase();
}

export type GammaGate = { available: boolean; reason: string };

/**
 * Server-side gate. Fails CLOSED: Gamma is available only if the experiment flag is on, the server
 * explicitly names its environment (GAMMA_ENVIRONMENT_NAME) and that name is in GAMMA_ALLOWED_ENVIRONMENTS,
 * the platform does not report production, the Supabase project is explicitly allowlisted (and is not the production one),
 * and the caller's email is on the tester list.
 * Unknown environment identity => unavailable. The client can never influence any of these inputs.
 */
export function gammaGate(email: string | null | undefined, env: Env = process.env): GammaGate {
  if (env.GAMMA_EXPERIMENT_ENABLED !== "true") return { available: false, reason: "experiment-disabled" };
  const name = env.GAMMA_ENVIRONMENT_NAME?.trim().toLowerCase();
  if (!name) return { available: false, reason: "environment-identity-unknown" };
  if (FORBIDDEN_ENVIRONMENTS.has(name) || env.VERCEL_ENV === "production") {
    return { available: false, reason: "production-environment" };
  }
  if (!csv(env.GAMMA_ALLOWED_ENVIRONMENTS).includes(name)) return { available: false, reason: "environment-not-allowlisted" };
  // Database safety net: independent of how env overrides resolve, the server must be pointed at an allowlisted, non-production project.
  const ref = supabaseRef(env);
  if (ref === PRODUCTION_SUPABASE_REF) return { available: false, reason: "production-database" };
  if (!ref || !csv(env.GAMMA_ALLOWED_SUPABASE_REFS).includes(ref)) return { available: false, reason: "database-not-allowlisted" };
  const e = email?.trim().toLowerCase();
  if (!e || !csv(env.GAMMA_TESTER_EMAILS).includes(e)) return { available: false, reason: "not-an-authorized-tester" };
  return { available: true, reason: "authorized" };
}

/** Provider the server would use when the client expresses no preference. Gamma only if the gate allows it. */
export function defaultProviderFor(email: string | null | undefined, env: Env = process.env): PptProvider {
  return env.PPT_GENERATION_PROVIDER === "gamma" && gammaGate(email, env).available ? "gamma" : "legacy";
}

/**
 * An explicit, valid client choice wins (so an authorised tester can always pick "legacy" even when the
 * server default is gamma); otherwise the server default applies. "gamma" is honoured only through the gate.
 */
export function resolvePptProvider(
  input: { requested?: unknown; email?: string | null },
  env: Env = process.env,
): { provider: PptProvider; reason: string } {
  const requested = input.requested === "legacy" || input.requested === "gamma" ? input.requested : undefined;
  const desired: PptProvider = requested ?? (env.PPT_GENERATION_PROVIDER === "gamma" ? "gamma" : "legacy");
  if (desired === "legacy") return { provider: "legacy", reason: requested ? "legacy-selected" : "default-legacy" };
  const gate = gammaGate(input.email, env);
  return gate.available ? { provider: "gamma", reason: gate.reason } : { provider: "legacy", reason: gate.reason };
}

export type GammaConfig = {
  apiKey: string;
  baseUrl: string;
  themeId?: string;
  imageSource: string;
  imageModel?: string;
  imageStyle?: string;
  pollIntervalMs: number;
  /** Abort timeout for ONE HTTP call (create / status / download). */
  requestTimeoutMs: number;
  /** How long one invocation may keep polling a pending generation before giving up (the job keeps running). */
  pollTimeoutMs: number;
  /** Hard budget for the whole invocation; must sit below the platform's function limit. */
  overallBudgetMs: number;
  maxPollErrors: number;
  maxCardsPerRun: number;
  maxCreditsPerRun: number;
  /** Credits assumed for an unsettled/new run when checking budgets. */
  estimatedCreditsPerRun: number;
  userHourlyLimit: number;
  userDailyLimit: number;
  dailyCreditBudget: number;
  monthlyCreditBudget: number;
  /** An active row without a Gamma id blocks the user this long before it is written off (credits stay reserved). */
  unknownQuarantineMs: number;
  /** A pending row older than this is abandoned (credits stay reserved). */
  staleActiveMs: number;
  /** How long a paid-but-undelivered generation stays resumable (Gamma export links last about a week). */
  undeliveredWindowMs: number;
  exportHosts: string[];
  maxDownloadBytes: number;
};

/**
 * Throws a clear error BEFORE any paid call if the key or the export-host allowlist is missing.
 * Gamma documents no export hostname, so there is deliberately no default allowlist.
 */
export function getGammaConfig(env: Env = process.env): GammaConfig {
  const apiKey = env.GAMMA_API_KEY?.trim();
  if (!apiKey) throw new GammaError("missing_credentials", "GAMMA_API_KEY is not configured on the server.");
  const exportHosts = csv(env.GAMMA_EXPORT_HOST_ALLOWLIST);
  if (exportHosts.length === 0) {
    throw new GammaError(
      "export_host_unconfigured",
      "GAMMA_EXPORT_HOST_ALLOWLIST is empty. Gamma does not document its export host, so it must be set explicitly before any paid generation.",
    );
  }
  const maxCreditsPerRun = num(env.GAMMA_MAX_CREDITS_PER_RUN, 300);
  return {
    apiKey,
    baseUrl: (env.GAMMA_API_BASE_URL?.trim() || "https://public-api.gamma.app/v1.0").replace(/\/$/, ""),
    themeId: env.GAMMA_THEME_ID?.trim() || undefined,
    imageSource: env.GAMMA_IMAGE_SOURCE?.trim() || "aiGenerated",
    // Unset by default: the docs do not enumerate model ids or tiers, so no model is guessed.
    imageModel: env.GAMMA_IMAGE_MODEL?.trim() || undefined,
    imageStyle: env.GAMMA_IMAGE_STYLE?.trim() || undefined,
    pollIntervalMs: num(env.GAMMA_POLL_INTERVAL_MS, 5_000),
    requestTimeoutMs: num(env.GAMMA_REQUEST_TIMEOUT_MS, 20_000),
    pollTimeoutMs: num(env.GAMMA_POLL_TIMEOUT_MS, 120_000),
    overallBudgetMs: num(env.GAMMA_OVERALL_BUDGET_MS, 160_000),
    maxPollErrors: 3,
    maxCardsPerRun: num(env.GAMMA_MAX_CARDS_PER_RUN, 25),
    maxCreditsPerRun,
    estimatedCreditsPerRun: num(env.GAMMA_ESTIMATED_CREDITS_PER_RUN, maxCreditsPerRun),
    userHourlyLimit: num(env.GAMMA_USER_HOURLY_LIMIT, 3),
    userDailyLimit: num(env.GAMMA_USER_DAILY_LIMIT, 10),
    dailyCreditBudget: num(env.GAMMA_DAILY_CREDIT_BUDGET, 1_000),
    monthlyCreditBudget: num(env.GAMMA_MONTHLY_CREDIT_BUDGET, 5_000),
    unknownQuarantineMs: num(env.GAMMA_UNKNOWN_QUARANTINE_MS, 30 * 60_000),
    staleActiveMs: num(env.GAMMA_STALE_ACTIVE_MS, 2 * 60 * 60_000),
    undeliveredWindowMs: num(env.GAMMA_UNDELIVERED_WINDOW_MS, 6 * 24 * 60 * 60_000),
    exportHosts,
    maxDownloadBytes: num(env.GAMMA_MAX_DOWNLOAD_BYTES, 50 * 1024 * 1024),
  };
}
