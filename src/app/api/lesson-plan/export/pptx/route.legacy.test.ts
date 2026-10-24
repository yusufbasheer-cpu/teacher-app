import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const renderPptxWithGamma = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest }));
vi.mock("@/lib/gamma/render", () => ({ renderPptxWithGamma }));
// NOTE: lesson-plan-export / the pptxgenjs renderer are deliberately NOT mocked: this proves the real legacy path still works.

import { extractPptx } from "@/lib/gamma/validate";
import { POST } from "./route";

const staging = {
  GAMMA_EXPERIMENT_ENABLED: "true",
  GAMMA_ENVIRONMENT_NAME: "staging",
  GAMMA_ALLOWED_ENVIRONMENTS: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123456789.supabase.co",
  GAMMA_ALLOWED_SUPABASE_REFS: "stagingref123456789",
  GAMMA_TESTER_EMAILS: "tester@x.com",
  PPT_GENERATION_PROVIDER: "gamma",
};

const pptContent = [
  "Slide 1: Linear equations",
  "Slide 2: Starter Activity\nWhat number am I thinking of? I add 5 and get 20.",
  "Slide 4: Learning Objectives\nSolve one-step equations.\nCheck a solution by substitution.",
  "Slide 6: Main Phase Core Teaching\nWe solve 3x + 5 = 20 by subtracting 5 and dividing by 3.",
].join("\n\n");

const post = (body: Record<string, unknown> = {}) =>
  POST(new Request("http://x/api/lesson-plan/export/pptx", {
    method: "POST",
    headers: { "x-forwarded-for": `8.8.8.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ subject: "Maths", grade: "Grade 8", topic: "Linear equations", pptContent, fullLessonPlan: pptContent, ...body }),
  }));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("legacy PPT export still works end to end (real route, real pptxgenjs renderer)", () => {
  const expectValidLegacyDeck = async (res: Response) => {
    expect(res.status).toBe(200);
    expect(res.headers.get("x-layah-ppt-provider")).toBeNull();
    expect(res.headers.get("content-type")).toContain("presentationml.presentation");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const deck = await extractPptx(buf);
    expect(deck.slides.length).toBeGreaterThanOrEqual(13);
    expect(deck.slides.some((s) => s.paragraphs.some((p) => p.text.includes("3x + 5 = 20")))).toBe(true);
  };

  it("default configuration", async () => {
    authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "u", accessToken: "t", email: "tester@x.com" });
    await expectValidLegacyDeck(await post());
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("authorised tester on a gamma-default server who explicitly selects legacy (the rollback path)", async () => {
    Object.entries(staging).forEach(([k, v]) => vi.stubEnv(k, v));
    authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "u", accessToken: "t", email: "tester@x.com" });
    await expectValidLegacyDeck(await post({ pptProvider: "legacy" }));
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("any other user on a gamma-default server", async () => {
    Object.entries(staging).forEach(([k, v]) => vi.stubEnv(k, v));
    authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "u2", accessToken: "t", email: "teacher@school.example" });
    await expectValidLegacyDeck(await post());
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("tester on a server whose database is production: Gamma refused, legacy served", async () => {
    Object.entries({ ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://jbwevzvtloahjoamwnjt.supabase.co", GAMMA_ALLOWED_SUPABASE_REFS: "jbwevzvtloahjoamwnjt" }).forEach(([k, v]) => vi.stubEnv(k, v));
    authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "u", accessToken: "t", email: "tester@x.com" });
    await expectValidLegacyDeck(await post({ pptProvider: "gamma" }));
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
});
