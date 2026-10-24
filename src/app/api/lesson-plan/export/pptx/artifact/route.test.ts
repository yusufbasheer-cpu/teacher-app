import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const findReusableArtifact = vi.hoisted(() => vi.fn());
const readGammaArtifact = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest }));
vi.mock("@/lib/gamma/store", () => ({
  SupabaseGammaStore: class {
    findReusableArtifact = findReusableArtifact;
  },
}));
vi.mock("@/lib/gamma/artifact", () => ({ readGammaArtifact }));

import { POST } from "./route";

const hash = "a".repeat(64);
const post = () => POST(new Request("https://example.test/api/lesson-plan/export/pptx/artifact", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ requestHash: hash, userId: "user-b" }),
}));

beforeEach(() => {
  vi.stubEnv("GAMMA_EXPERIMENT_ENABLED", "true");
  vi.stubEnv("GAMMA_ENVIRONMENT_NAME", "staging");
  vi.stubEnv("GAMMA_ALLOWED_ENVIRONMENTS", "staging");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://stagingref123456789.supabase.co");
  vi.stubEnv("GAMMA_ALLOWED_SUPABASE_REFS", "stagingref123456789");
  vi.stubEnv("GAMMA_TESTER_EMAILS", "a@example.test");
  authenticateRequest.mockResolvedValue({ ok: true, userId: "user-a", email: "a@example.test" });
  findReusableArtifact.mockResolvedValue({
    artifactPath: "user-a/artifact.pptx",
    validationReport: { verdict: "passed" },
  });
  readGammaArtifact.mockResolvedValue(Buffer.from("PK-owned"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Gamma artifact ownership", () => {
  it("rejects an anonymous download before artifact lookup", async () => {
    authenticateRequest.mockResolvedValue({ ok: false, status: 401, message: "Unauthorized" });
    expect((await post()).status).toBe(401);
    expect(findReusableArtifact).not.toHaveBeenCalled();
  });

  it("scopes lookup to the verified caller and ignores a manipulated userId", async () => {
    expect((await post()).status).toBe(200);
    expect(findReusableArtifact).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-a",
      requestHash: hash,
    }));
  });

  it("does not read storage when no caller-owned artifact matches", async () => {
    findReusableArtifact.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    expect(readGammaArtifact).not.toHaveBeenCalled();
  });
});
