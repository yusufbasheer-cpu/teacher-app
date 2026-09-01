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

  it("defaults verify-captcha to Next when no routing config is present", async () => {
    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("verify-captcha")).toMatchObject({
      target: "next",
      pythonUrl: null,
      reason: "default_next",
    });
  });

  it("uses Python for verify-captcha only when its own flag and backend URL are valid", async () => {
    vi.stubEnv("BACKEND_ROUTE_VERIFY_CAPTCHA", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");

    const { resolveBackendRoute } = await import("./backend-routing");

    const decision = resolveBackendRoute("verify-captcha");
    expect(decision.target).toBe("python");
    expect(decision.pythonUrl?.toString()).toBe("https://python.internal/api/auth/verify-captcha");
  });

  it("keeps geo and verify-captcha routing flags fully independent", async () => {
    vi.stubEnv("BACKEND_ROUTE_GEO", "python");
    vi.stubEnv("PYTHON_BACKEND_URL", "https://python.internal");

    const { resolveBackendRoute } = await import("./backend-routing");

    expect(resolveBackendRoute("geo").target).toBe("python");
    expect(resolveBackendRoute("verify-captcha")).toMatchObject({
      target: "next",
      reason: "default_next",
    });
  });

  it("does not attach a protection bypass header when unconfigured", async () => {
    const { applyDeploymentProtectionBypass } = await import("./backend-routing");

    const headers = new Headers();
    applyDeploymentProtectionBypass(headers);

    expect(headers.has("x-vercel-protection-bypass")).toBe(false);
  });

  it("attaches the protection bypass header only when explicitly configured", async () => {
    vi.stubEnv("PYTHON_BACKEND_BYPASS_SECRET", "test-bypass-secret");
    const { applyDeploymentProtectionBypass } = await import("./backend-routing");

    const headers = new Headers();
    applyDeploymentProtectionBypass(headers);

    expect(headers.get("x-vercel-protection-bypass")).toBe("test-bypass-secret");
  });
});
