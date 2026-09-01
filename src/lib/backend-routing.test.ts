import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("backend routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults to Next when no routing config is present", async () => {
    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("geo")).toMatchObject({
      target: "next",
      pythonUrl: null,
      reason: "default_next",
    });
  });

  it("uses Next when geo is explicitly configured for Next", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "next");

    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("geo")).toMatchObject({
      target: "next",
      reason: "explicit_next",
    });
  });

  it("uses Python for geo only when the endpoint flag and backend URL are valid", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");

    const { resolveBackendRoute } = await import("./backend-routing");

    const decision = resolveBackendRoute("geo");
    expect(decision.target).toBe("python");
    expect(decision.pythonUrl?.toString()).toBe("https://python.internal/api/geo");
  });

  it("falls safely back to Next when Python is selected without a URL", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");

    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("geo")).toMatchObject({
      target: "next",
      pythonUrl: null,
      reason: "missing_python_url",
    });
  });

  it("falls safely back to Next for malformed or unsafe Python URLs", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");

    const { resolveBackendRoute } = await import("./backend-routing");

    for (const url of [
      "not a url",
      "javascript:alert(1)",
      "data:text/plain,hello",
      "https://user:pass@python.internal",
    ]) {
      vi.stubEnv("PYTHON_BACKEND_URL", url);
      expect(resolveBackendRoute("geo")).toMatchObject({
        target: "next",
        pythonUrl: null,
        reason: "invalid_python_url",
      });
    }
  });

  it("does not expose unrelated endpoints to Python routing", async () => {
    vi.stubEnv("BACKEND_ROUTE_LESSON_PLAN_SAVE", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");

    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("geo")).toMatchObject({
      target: "next",
      reason: "default_next",
    });
  });

  it("joins base URLs with and without trailing slashes to /api/geo exactly once", async () => {
    const { buildPythonBackendUrl } = await import("./backend-routing");

    expect(buildPythonBackendUrl(new URL("https://example.internal"), "/api/geo").toString()).toBe(
      "https://example.internal/api/geo",
    );
    expect(
      buildPythonBackendUrl(new URL("https://example.internal/"), "/api/geo").toString(),
    ).toBe("https://example.internal/api/geo");
  });
});
