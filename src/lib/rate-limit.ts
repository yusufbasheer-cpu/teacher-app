// In-memory rate limiter for Node.js route handlers.
// Resets on cold starts. For persistent distributed limiting across multiple
// serverless instances, swap for Upstash Redis when the payment gateway is live.

type RateLimitWindow = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitWindow>();

function cleanup(): void {
  if (store.size < 500) return;
  const now = Date.now();
  for (const [key, w] of store.entries()) {
    if (now >= w.resetAt) store.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetInSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetInSeconds: Math.ceil(windowMs / 1000) };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetInSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { ok: true, remaining: limit - entry.count, resetInSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

/** Extract the real client IP from common proxy headers. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? "unknown";
}

/** Standard 429 JSON response with human-readable wait time. */
export function rateLimitResponse(resetInSeconds: number): Response {
  const minutes = Math.ceil(resetInSeconds / 60);
  return new Response(
    JSON.stringify({
      error: `Too many requests. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resetInSeconds),
      },
    },
  );
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
const SPENDING_LIMIT = 50;

/**
 * Spending protection: block users who exceed 50 API calls/hour.
 * Returns alerted=true only on the FIRST block per window so callers
 * know to send exactly one alert email.
 */
export function checkSpendingProtection(userId: string): {
  blocked: boolean;
  shouldAlert: boolean;
  resetInSeconds: number;
} {
  const spend = checkRateLimit(`spend:${userId}`, SPENDING_LIMIT, HOUR_MS);
  if (spend.ok) return { blocked: false, shouldAlert: false, resetInSeconds: 0 };

  const alert = checkRateLimit(`spend_alert:${userId}`, 1, HOUR_MS);
  return { blocked: true, shouldAlert: alert.ok, resetInSeconds: spend.resetInSeconds };
}
