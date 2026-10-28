import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitFailurePolicy = "closed" | "bounded-fallback";
export type RateLimitFailureReason = "missing-configuration" | "redis-unavailable" | "timeout";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetInSeconds: number;
  unavailable?: RateLimitFailureReason;
  source: "redis" | "local-fallback";
};

type RemoteLimitResponse = {
  success: boolean;
  remaining: number;
  reset: number;
  reason?: string;
};

type RemoteLimiter = { limit(identifier: string): Promise<RemoteLimitResponse> };
type RemoteLimiterFactory = (limit: number, windowMs: number) => RemoteLimiter;
type LocalWindow = { count: number; resetAt: number };

const LOCAL_FALLBACK_MAX_KEYS = 500;
const INFRASTRUCTURE_RETRY_AFTER_SECONDS = 30;
const DEFAULT_REDIS_TIMEOUT_MS = 5_000;
const REDIS_TIMEOUT = Symbol("redis-timeout");

function rateLimitNamespace(): string {
  // Production and staging must never share counters. Override only for an
  // intentionally isolated environment (for example, a local test namespace).
  if (process.env.RATE_LIMIT_NAMESPACE) return process.env.RATE_LIMIT_NAMESPACE;
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "staging";
  return "development";
}

function configuration(): { url?: string; token?: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  };
}

function createRedisFactory(url: string, token: string, namespace: string): RemoteLimiterFactory {
  const redis = new Redis({ url, token });
  const limiters = new Map<string, RemoteLimiter>();
  return (limit, windowMs) => {
    const cacheKey = `${limit}:${windowMs}`;
    const existing = limiters.get(cacheKey);
    if (existing) return existing;
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs}ms`),
      prefix: `layah:${namespace}:rate-limit`,
      ephemeralCache: false,
      // The Upstash SDK defaults to 5 seconds then returns success=true. A
      // zero timeout disables that bypass, letting this module apply policy.
      timeout: 0,
    });
    limiters.set(cacheKey, limiter);
    return limiter;
  };
}

export function createRateLimitService(options: {
  remoteFactory?: RemoteLimiterFactory;
  missingConfiguration?: boolean;
  timeoutMs?: number;
  onFailure?: (reason: RateLimitFailureReason, error?: unknown) => void;
} = {}) {
  const localStore = new Map<string, LocalWindow>();
  const remoteLimiters = new Map<string, RemoteLimiter>();

  function cleanupLocalStore(): void {
    const now = Date.now();
    for (const [key, window] of localStore.entries()) {
      if (now >= window.resetAt) localStore.delete(key);
    }
  }

  function checkLocal(key: string, limit: number, windowMs: number): RateLimitResult {
    cleanupLocalStore();
    const now = Date.now();
    const existing = localStore.get(key);
    if (!existing) {
      // The fallback is deliberately bounded. Exhaustion denies new keys rather
      // than allowing unbounded memory growth or silently accepting all traffic.
      if (localStore.size >= LOCAL_FALLBACK_MAX_KEYS) {
        return { ok: false, remaining: 0, resetInSeconds: INFRASTRUCTURE_RETRY_AFTER_SECONDS, source: "local-fallback" };
      }
      localStore.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, resetInSeconds: Math.ceil(windowMs / 1000), source: "local-fallback" };
    }
    if (existing.count >= limit) {
      return { ok: false, remaining: 0, resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)), source: "local-fallback" };
    }
    existing.count += 1;
    return { ok: true, remaining: limit - existing.count, resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)), source: "local-fallback" };
  }

  async function check(
    key: string,
    limit: number,
    windowMs: number,
    policy: RateLimitFailurePolicy,
  ): Promise<RateLimitResult> {
    const missing = options.missingConfiguration ?? !options.remoteFactory;
    if (missing) return unavailable("missing-configuration", policy, key, limit, windowMs);

    try {
      const cacheKey = `${limit}:${windowMs}`;
      let limiter = remoteLimiters.get(cacheKey);
      if (!limiter) {
        limiter = options.remoteFactory!(limit, windowMs);
        remoteLimiters.set(cacheKey, limiter);
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutMs = options.timeoutMs ?? Number(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS ?? DEFAULT_REDIS_TIMEOUT_MS);
      const result = await Promise.race([
        limiter.limit(key),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(REDIS_TIMEOUT), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REDIS_TIMEOUT_MS);
        }),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });
      // Defensive handling for SDK timeout responses. This must remain an
      // infrastructure failure even if an SDK version labels it successful.
      if (result.reason === "timeout") return unavailable("timeout", policy, key, limit, windowMs);
      return {
        ok: result.success,
        remaining: result.remaining,
        resetInSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        source: "redis",
      };
    } catch (error) {
      return unavailable(error === REDIS_TIMEOUT ? "timeout" : "redis-unavailable", policy, key, limit, windowMs, error);
    }
  }

  function unavailable(
    reason: RateLimitFailureReason,
    policy: RateLimitFailurePolicy,
    key: string,
    limit: number,
    windowMs: number,
    error?: unknown,
  ): RateLimitResult {
    options.onFailure?.(reason, error);
    if (policy === "bounded-fallback") return checkLocal(key, limit, windowMs);
    return {
      ok: false,
      remaining: 0,
      resetInSeconds: INFRASTRUCTURE_RETRY_AFTER_SECONDS,
      unavailable: reason,
      source: "redis",
    };
  }

  return { check };
}

const config = configuration();
const service = createRateLimitService({
  ...(config.url && config.token ? { remoteFactory: createRedisFactory(config.url, config.token, rateLimitNamespace()) } : {}),
  missingConfiguration: !(config.url && config.token),
  onFailure: (reason, error) => console.error("[rate-limit] infrastructure unavailable", { reason, error }),
});

/**
 * A distributed rate limit. Closed policy is mandatory for paid generation,
 * authentication abuse controls, sensitive account actions, and high-cost
 * exports. Bounded fallback is reserved for low-risk public forms and alerts.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  policy: RateLimitFailurePolicy = "closed",
): Promise<RateLimitResult> {
  return service.check(key, limit, windowMs, policy);
}

/** Extract the client IP supplied by the trusted Vercel proxy. */
export function getClientIp(req: Request): string {
  const vercelForwarded = req.headers.get("x-vercel-forwarded-for");
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return vercelForwarded?.split(",")[0]?.trim() ?? forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? "unknown";
}

export function rateLimitResponse(resetInSeconds: number, unavailable?: RateLimitFailureReason): Response {
  if (unavailable) return rateLimitUnavailableResponse();
  const minutes = Math.ceil(resetInSeconds / 60);
  return new Response(JSON.stringify({ error: `Too many requests. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.` }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(resetInSeconds) },
  });
}

/** Used by fail-closed routes when Redis credentials are absent or Redis fails. */
export function rateLimitUnavailableResponse(): Response {
  return new Response(JSON.stringify({ error: "Request protection is temporarily unavailable. Please try again shortly." }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Retry-After": String(INFRASTRUCTURE_RETRY_AFTER_SECONDS) },
  });
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const SPENDING_LIMIT = 50;

export async function checkSpendingProtection(userId: string): Promise<{ blocked: boolean; shouldAlert: boolean; resetInSeconds: number; unavailable?: RateLimitFailureReason }> {
  const spend = await checkRateLimit(`spend:${userId}`, SPENDING_LIMIT, HOUR_MS, "closed");
  if (spend.unavailable) return { blocked: false, shouldAlert: false, resetInSeconds: spend.resetInSeconds, unavailable: spend.unavailable };
  if (spend.ok) return { blocked: false, shouldAlert: false, resetInSeconds: 0 };

  // Alerts are intentionally bounded-fallback: Redis failure still allows one
  // critical notification per process/hour, while avoiding an alert flood.
  const alert = await checkRateLimit(`spend_alert:${userId}`, 1, HOUR_MS, "bounded-fallback");
  return { blocked: true, shouldAlert: alert.ok, resetInSeconds: spend.resetInSeconds };
}
