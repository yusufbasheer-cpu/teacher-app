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
  | "timeout"
  | "generation_failed"
  | "api_error"
  | "download_rejected"
  | "invalid_export"
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

/** True when the caller (env default or request field) is asking for Gamma. */
export function wantsGamma(requested: unknown, env: Env = process.env): boolean {
  const asked = typeof requested === "string" && requested ? requested : env.PPT_GENERATION_PROVIDER;
  return asked === "gamma";
}

/**
 * Gamma is selectable only when ALL hold: experiment flag on, not Vercel production,
 * and the caller's email is on the tester allowlist. Everything else is legacy.
 */
export function resolvePptProvider(
  input: { requested?: unknown; email?: string | null },
  env: Env = process.env,
): { provider: PptProvider; reason: string } {
  if (!wantsGamma(input.requested, env)) return { provider: "legacy", reason: "not-requested" };
  if (env.GAMMA_EXPERIMENT_ENABLED !== "true") return { provider: "legacy", reason: "experiment-disabled" };
  if (env.VERCEL_ENV === "production") return { provider: "legacy", reason: "production-environment" };
  const email = input.email?.trim().toLowerCase();
  if (!email || !csv(env.GAMMA_TESTER_EMAILS).includes(email)) {
    return { provider: "legacy", reason: "not-an-authorized-tester" };
  }
  return { provider: "gamma", reason: "authorized" };
}

export type GammaConfig = {
  apiKey: string;
  baseUrl: string;
  themeId?: string;
  imageSource: string;
  imageModel?: string;
  imageStyle?: string;
  pollIntervalMs: number;
  timeoutMs: number;
  maxPollErrors: number;
  maxCardsPerRun: number;
  maxCreditsPerRun: number;
  experimentCreditBudget: number;
  exportHostSuffixes: string[];
  maxDownloadBytes: number;
};

/** Throws a clear error if the key is missing. Only called after provider selection resolved to gamma. */
export function getGammaConfig(env: Env = process.env): GammaConfig {
  const apiKey = env.GAMMA_API_KEY?.trim();
  if (!apiKey) {
    throw new GammaError("missing_credentials", "GAMMA_API_KEY is not configured on the server.");
  }
  return {
    apiKey,
    baseUrl: (env.GAMMA_API_BASE_URL?.trim() || "https://public-api.gamma.app/v1.0").replace(/\/$/, ""),
    themeId: env.GAMMA_THEME_ID?.trim() || undefined,
    imageSource: env.GAMMA_IMAGE_SOURCE?.trim() || "aiGenerated",
    // Left unset by default: the docs do not enumerate model ids or tiers, so we do not guess one.
    imageModel: env.GAMMA_IMAGE_MODEL?.trim() || undefined,
    imageStyle: env.GAMMA_IMAGE_STYLE?.trim() || undefined,
    pollIntervalMs: num(env.GAMMA_POLL_INTERVAL_MS, 5_000),
    // Route maxDuration is 180s; stay below it.
    timeoutMs: num(env.GAMMA_TIMEOUT_MS, 150_000),
    maxPollErrors: 3,
    maxCardsPerRun: num(env.GAMMA_MAX_CARDS_PER_RUN, 25),
    maxCreditsPerRun: num(env.GAMMA_MAX_CREDITS_PER_RUN, 300),
    experimentCreditBudget: num(env.GAMMA_EXPERIMENT_CREDIT_BUDGET, 3_000),
    // UNVERIFIED against a live export URL; override with GAMMA_EXPORT_HOST_ALLOWLIST if Gamma serves exports elsewhere.
    exportHostSuffixes: csv(env.GAMMA_EXPORT_HOST_ALLOWLIST).length
      ? csv(env.GAMMA_EXPORT_HOST_ALLOWLIST)
      : ["gamma.app"],
    maxDownloadBytes: num(env.GAMMA_MAX_DOWNLOAD_BYTES, 50 * 1024 * 1024),
  };
}
