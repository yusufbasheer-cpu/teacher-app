import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBlob, apiFetch, apiJson } from "./frontend-api-client";

const { getAuthHeaders, getAuthOnlyHeaders } = vi.hoisted(() => ({
  getAuthHeaders: vi.fn(),
  getAuthOnlyHeaders: vi.fn(),
}));

vi.mock("@/lib/auth-headers", () => ({ getAuthHeaders, getAuthOnlyHeaders }));

describe("frontendApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAuthHeaders.mockReset();
    getAuthOnlyHeaders.mockReset();
    getAuthHeaders.mockImplementation(async (extra: Record<string, string> = {}) => ({
      "Content-Type": "application/json",
      ...extra,
      Authorization: "Bearer test-token",
      "X-Auth": "json",
    }));
    getAuthOnlyHeaders.mockImplementation(async () => ({
      Authorization: "Bearer test-token",
      "X-Auth": "bare",
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-local paths so it stays a frontend-to-backend API client", async () => {
    await expect(apiFetch("https://example.com/api/lesson-plan")).rejects.toThrow(
      "Frontend API client only accepts local /api/ paths.",
    );
  });

  it("uses getAuthHeaders for authenticated JSON requests and serializes the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/auth/verify-captcha", {
      auth: "bearer",
      method: "POST",
      json: { token: "abc123" },
      headers: { "X-Trace": "trace-1" },
    });

    expect(getAuthHeaders).toHaveBeenCalledTimes(1);
    expect(getAuthOnlyHeaders).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-auth")).toBe("json");
    expect(headers.get("x-trace")).toBe("trace-1");
    expect((init as RequestInit).body).toBe(JSON.stringify({ token: "abc123" }));
  });

  it("uses getAuthOnlyHeaders for authenticated requests without JSON bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/user-usage", {
      auth: "bearer",
      cache: "no-store",
      headers: { "X-Mode": "refresh" },
    });

    expect(getAuthOnlyHeaders).toHaveBeenCalledTimes(1);
    expect(getAuthHeaders).not.toHaveBeenCalled();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("x-auth")).toBe("bare");
    expect(headers.get("x-mode")).toBe("refresh");
    expect(headers.get("content-type")).toBeNull();
  });

  it("parses JSON through the shared parser while preserving the Response object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ usage: { planType: "free" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiJson<{ usage: { planType: string } }>("/api/user-usage", {
      auth: "bearer",
      logLabel: "user-usage",
    });

    expect(result.response.status).toBe(200);
    expect(result.parsed.ok).toBe(true);
    if (result.parsed.ok) {
      expect(result.parsed.data.usage.planType).toBe("free");
    }
  });

  it("returns a raw preview when the response body is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not json", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiJson<{ ok: boolean }>("/api/auth/verify-captcha", {
      method: "POST",
      json: { token: "abc123" },
      logLabel: "captcha",
    });

    expect(result.response.status).toBe(500);
    expect(result.parsed.ok).toBe(false);
    if (!result.parsed.ok) {
      expect(result.parsed.rawPreview).toBe("not json");
    }
  });

  it("can read blob responses for download flows", async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiBlob("/api/question-paper/export/docx", {
      auth: "bearer",
    });

    expect(result.response.ok).toBe(true);
    expect(result.blob.size).toBe(3);
    expect(result.blob.type).toBe("application/octet-stream");
  });
});
