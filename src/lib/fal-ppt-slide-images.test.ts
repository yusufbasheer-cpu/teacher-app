/**
 * Fal failure classification.
 *
 * The regression these lock down: `withTimeout` wrapped the fal call in `catch { return null }`,
 * so a 401 or 402 that came back in milliseconds was logged as "timed out after 90000ms", the
 * account-locked circuit breaker could never fire, and the real cause was unobservable. The
 * fal client is mocked throughout — no paid requests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn();

class FakeApiError extends Error {
  status: number;
  body: unknown;
  requestId = "req-test";
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

class FakeValidationError extends FakeApiError {}

vi.mock("@fal-ai/client", () => ({
  createFalClient: () => ({ subscribe: (...a: unknown[]) => subscribe(...a) }),
  ApiError: FakeApiError,
  ValidationError: FakeValidationError,
}));

const { generateFalPptImageFromPrompt, resetFalPptCircuitForTests, getFalPptCircuitOpenReason } =
  await import("./fal-ppt-slide-images");

beforeEach(() => {
  vi.clearAllMocks();
  resetFalPptCircuitForTests();
  process.env.FAL_API_KEY = "0123456789abcdef-0123-4567-89ab-cdef01234567:0123456789abcdef0123456789abcdef";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetFalPptCircuitForTests();
});

describe("successful generation", () => {
  it("returns the image URL from the fal response", async () => {
    subscribe.mockResolvedValue({ data: { images: [{ url: "https://v3.fal.media/x.png" }] } });

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toEqual({ ok: true, url: "https://v3.fal.media/x.png" });
  });

  it("reports an empty response distinctly from an error", async () => {
    subscribe.mockResolvedValue({ data: { images: [] } });

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toMatchObject({ ok: false, kind: "empty-response" });
  });
});

describe("failure classification", () => {
  it("reports a bad key as auth, not as a timeout", async () => {
    subscribe.mockRejectedValue(new FakeApiError(401, { detail: "Unauthorized" }));

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toMatchObject({ ok: false, kind: "auth" });
    if (!outcome.ok) expect(outcome.reason).not.toMatch(/timed out/i);
  });

  it("reports a rate limit as rate-limit", async () => {
    subscribe.mockRejectedValue(new FakeApiError(429, { detail: "Too Many Requests" }));

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toMatchObject({ ok: false, kind: "rate-limit" });
  });

  it("reports an exhausted balance as balance and opens the circuit breaker", async () => {
    subscribe.mockRejectedValue(new FakeApiError(403, { detail: "exhausted balance" }));

    expect(getFalPptCircuitOpenReason()).toBeNull();
    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toMatchObject({ ok: false, kind: "balance" });
    // Every remaining slot would fail identically and each costs a full round trip.
    expect(getFalPptCircuitOpenReason()).toBeTruthy();
  });

  it("short-circuits subsequent calls once the breaker is open", async () => {
    subscribe.mockRejectedValue(new FakeApiError(403, { detail: "user is locked" }));
    await generateFalPptImageFromPrompt("first");
    subscribe.mockClear();

    const outcome = await generateFalPptImageFromPrompt("second");

    expect(subscribe).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, kind: "circuit-open" });
  });

  it("still reports a genuine hang as a timeout", async () => {
    vi.useFakeTimers();
    subscribe.mockImplementation(() => new Promise(() => {}));

    const pending = generateFalPptImageFromPrompt("a prompt");
    await vi.advanceTimersByTimeAsync(95_000);
    const outcome = await pending;

    expect(outcome).toMatchObject({ ok: false, kind: "timeout" });
    vi.useRealTimers();
  });

  it("does not open the circuit breaker for a transient error", async () => {
    subscribe.mockRejectedValue(new FakeApiError(500, { detail: "server error" }));

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(outcome).toMatchObject({ ok: false, kind: "error" });
    expect(getFalPptCircuitOpenReason()).toBeNull();
  });
});

describe("credentials", () => {
  it("reports missing credentials without calling fal", async () => {
    delete process.env.FAL_API_KEY;
    delete process.env.FAL_KEY;

    const outcome = await generateFalPptImageFromPrompt("a prompt");

    expect(subscribe).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false, kind: "not-configured" });
  });

  it("never writes any part of the key to the logs", async () => {
    const secret = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:ffffffffffffffffffffffffffffffff";
    process.env.FAL_API_KEY = secret;
    subscribe.mockResolvedValue({ data: { images: [{ url: "https://v3.fal.media/x.png" }] } });
    const errorSpy = console.error as unknown as ReturnType<typeof vi.fn>;

    await generateFalPptImageFromPrompt("a prompt");

    const logged = errorSpy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(secret);
    // A masked preview still leaks length and the leading/trailing characters.
    expect(logged).not.toContain("aaaa");
    expect(logged).not.toContain("ffff");
  });
});
