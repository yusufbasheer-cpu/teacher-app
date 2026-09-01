import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveGeoLocation = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/geo-service", () => ({
  resolveGeoLocation,
}));

describe("geo route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resolveGeoLocation.mockReset();
  });

  it("keeps the default path on the existing TypeScript geo service", async () => {
    resolveGeoLocation.mockResolvedValue({ country_code: "IN", country_name: "India" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/geo", {
        headers: { "x-vercel-ip-country": "IN" },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country_code: "IN", country_name: "India" });
    expect(resolveGeoLocation).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies geo to Python when explicitly configured", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal/");
    resolveGeoLocation.mockResolvedValue({ country_code: "AE", country_name: "UAE" });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ country_code: "GB", country_name: "United Kingdom" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/geo", {
        headers: {
          Authorization: "Bearer should-not-forward",
          Cookie: "session=should-not-forward",
          "x-vercel-ip-country": "GB",
          "x-forwarded-for": "203.0.113.1",
        },
      }) as never,
    );

    expect(res.status).toBe(202);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ country_code: "GB", country_name: "United Kingdom" });
    expect(resolveGeoLocation).not.toHaveBeenCalled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://python.internal/api/geo");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get("accept")).toBe("application/json");
    expect(forwardedHeaders.get("x-vercel-ip-country")).toBe("GB");
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.1");
    expect(forwardedHeaders.has("authorization")).toBe(false);
    expect(forwardedHeaders.has("cookie")).toBe(false);
    expect(forwardedHeaders.has("x-vercel-protection-bypass")).toBe(false);
  });

  it("attaches a deployment-protection bypass header only when explicitly configured", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal/");
    vi.stubEnv("PYTHON_BACKEND_BYPASS_SECRET", "test-bypass-secret");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ country_code: "IN", country_name: "IN" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/geo") as never);

    const [, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get("x-vercel-protection-bypass")).toBe("test-bypass-secret");
  });

  it("falls back to the Next geo service on Python transport failure", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    resolveGeoLocation.mockResolvedValue({ country_code: "AE", country_name: "UAE" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("connection refused");
      }),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/geo") as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country_code: "AE", country_name: "UAE" });
    expect(resolveGeoLocation).toHaveBeenCalledTimes(1);
  });

  it("forwards valid Python HTTP error responses without Next fallback", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "upstream error" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/geo") as never);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ detail: "upstream error" });
    expect(resolveGeoLocation).not.toHaveBeenCalled();
  });
});
