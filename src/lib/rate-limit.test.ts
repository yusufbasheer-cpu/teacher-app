import { describe, expect, it, vi } from "vitest";
import { createRateLimitService, rateLimitResponse } from "./rate-limit";

function sharedCounter() {
  const windows = new Map<string, { count: number; reset: number }>();
  return (limit: number, windowMs: number) => ({
    async limit(identifier: string) {
      const now = Date.now();
      const key = `${limit}:${windowMs}:${identifier}`;
      const existing = windows.get(key);
      const entry = !existing || existing.reset <= now ? { count: 0, reset: now + windowMs } : existing;
      entry.count += 1;
      windows.set(key, entry);
      return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count), reset: entry.reset };
    },
  });
}

describe("distributed rate-limit policy", () => {
  it("shares counters across independent application instances", async () => {
    const factory = sharedCounter();
    const first = createRateLimitService({ remoteFactory: factory });
    const second = createRateLimitService({ remoteFactory: factory });
    expect((await first.check("user-a", 2, 1_000, "closed")).ok).toBe(true);
    expect((await second.check("user-a", 2, 1_000, "closed")).ok).toBe(true);
    expect((await first.check("user-a", 2, 1_000, "closed")).ok).toBe(false);
  });

  it("handles concurrent duplicate attempts without retries", async () => {
    const service = createRateLimitService({ remoteFactory: sharedCounter() });
    const results = await Promise.all(Array.from({ length: 8 }, () => service.check("same-request", 3, 1_000, "closed")));
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok)).toHaveLength(5);
  });

  it("resets after expiry", async () => {
    vi.useFakeTimers();
    try {
      const service = createRateLimitService({ remoteFactory: sharedCounter() });
      expect((await service.check("u", 1, 1_000, "closed")).ok).toBe(true);
      expect((await service.check("u", 1, 1_000, "closed")).ok).toBe(false);
      await vi.advanceTimersByTimeAsync(1_000);
      expect((await service.check("u", 1, 1_000, "closed")).ok).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("returns 503 for absent or invalid Redis on required routes", async () => {
    for (const service of [
      createRateLimitService({ missingConfiguration: true }),
      createRateLimitService({ remoteFactory: () => ({ limit: async () => { throw new Error("invalid credentials"); } }) }),
    ]) {
      const result = await service.check("paid-user", 1, 1_000, "closed");
      expect(result.unavailable).toBeTruthy();
      const response = rateLimitResponse(result.resetInSeconds, result.unavailable);
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
    }
  });

  it("treats an SDK timeout as unavailable instead of accepting it", async () => {
    const service = createRateLimitService({ remoteFactory: () => ({ limit: async () => ({ success: true, remaining: 0, reset: Date.now(), reason: "timeout" }) }) });
    expect(await service.check("paid-user", 1, 1_000, "closed")).toMatchObject({ ok: false, unavailable: "timeout" });
  });

  it("does not hang forever when Redis never responds", async () => {
    vi.useFakeTimers();
    try {
      const service = createRateLimitService({ timeoutMs: 100, remoteFactory: () => ({ limit: async () => new Promise<never>(() => {}) }) });
      const resultPromise = service.check("hung", 1, 1_000, "closed");
      await vi.advanceTimersByTimeAsync(100);
      await expect(resultPromise).resolves.toMatchObject({ ok: false, unavailable: "timeout" });
    } finally { vi.useRealTimers(); }
  });

  it("uses a bounded fallback only when explicitly requested", async () => {
    const service = createRateLimitService({ missingConfiguration: true });
    expect((await service.check("public", 1, 1_000, "bounded-fallback")).source).toBe("local-fallback");
    expect((await service.check("public", 1, 1_000, "bounded-fallback")).ok).toBe(false);
  });

  it("returns 429 with Retry-After for a real limit", async () => {
    const service = createRateLimitService({ remoteFactory: sharedCounter() });
    await service.check("u", 1, 1_000, "closed");
    const limited = await service.check("u", 1, 1_000, "closed");
    const response = rateLimitResponse(limited.resetInSeconds, limited.unavailable);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
