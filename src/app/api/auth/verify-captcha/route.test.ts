import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CaptchaFixtureCase = {
  name: string;
  secretConfigured: boolean;
  rawBody?: string;
  body?: Record<string, unknown>;
  turnstileResponse?: { status: number; json?: Record<string, unknown>; networkError?: boolean };
  turnstileCalled: boolean;
  expectedTurnstileToken?: string;
  expected: { status: number; json: Record<string, unknown> };
};

const fixturePath = resolve(
  process.cwd(),
  "contract-fixtures",
  "verify-captcha",
  "verify-captcha-contract.json",
);
const cases = JSON.parse(readFileSync(fixturePath, "utf-8")) as { cases: CaptchaFixtureCase[] };

vi.mock("server-only", () => ({}));

describe("verify-captcha route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(cases.cases)("matches the shared contract for $name", async (scenario) => {
    if (scenario.secretConfigured) {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    } else {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    }

    const fetchMock = vi.fn(async () => {
      const turnstile = scenario.turnstileResponse;
      if (!turnstile || turnstile.networkError) {
        throw new TypeError("network error");
      }
      return new Response(JSON.stringify(turnstile.json ?? {}), {
        status: turnstile.status,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const bodyInit =
      scenario.rawBody !== undefined ? scenario.rawBody : JSON.stringify(scenario.body ?? {});
    const req = new Request("http://localhost/api/auth/verify-captcha", {
      method: "POST",
      body: bodyInit,
    });

    const res = await POST(req);

    expect(res.status).toBe(scenario.expected.status);
    expect(await res.json()).toEqual(scenario.expected.json);

    if (scenario.turnstileCalled) {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (scenario.expectedTurnstileToken) {
        const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit];
        const sentBody = JSON.parse(init.body as string) as { response: string };
        expect(sentBody.response).toBe(scenario.expectedTurnstileToken);
      }
    } else {
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("keeps the default path on Next when no routing config is present", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/verify-captcha", { method: "POST", body: "{}" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies to Python when explicitly configured, without forwarding Authorization/Cookie", async () => {
    vi.stubEnv("BACKEND_ROUTE_VERIFY_CAPTCHA", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal/");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/verify-captcha", {
        method: "POST",
        body: JSON.stringify({ token: "abc" }),
        headers: {
          Authorization: "Bearer should-not-forward",
          Cookie: "session=should-not-forward",
          "x-forwarded-for": "203.0.113.1",
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://python.internal/api/auth/verify-captcha");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ token: "abc" }));
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.1");
    expect(forwardedHeaders.has("authorization")).toBe(false);
    expect(forwardedHeaders.has("cookie")).toBe(false);
  });

  it("forwards valid Python HTTP error responses as-is", async () => {
    vi.stubEnv("BACKEND_ROUTE_VERIFY_CAPTCHA", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: "Captcha verification failed. Please try again." }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/verify-captcha", {
        method: "POST",
        body: JSON.stringify({ token: "bad" }),
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "Captcha verification failed. Please try again." });
  });

  it("does NOT fall back to Next on Python transport failure (single-use token safety)", async () => {
    vi.stubEnv("BACKEND_ROUTE_VERIFY_CAPTCHA", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "should-not-be-used");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("connection refused");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/auth/verify-captcha", {
        method: "POST",
        body: JSON.stringify({ token: "abc" }),
      }),
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      ok: false,
      error: "Captcha verification is temporarily unavailable. Please try again.",
    });
    // Exactly one fetch call (the failed Python attempt) — no second call
    // to Turnstile via the Next path, proving no fallback occurred.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
