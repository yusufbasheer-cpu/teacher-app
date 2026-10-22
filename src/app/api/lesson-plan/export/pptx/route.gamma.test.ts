import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateRequest = vi.hoisted(() => vi.fn());
const renderPptxWithGamma = vi.hoisted(() => vi.fn());
const buildPptxFromPptContent = vi.hoisted(() => vi.fn());
const generatePptDeckSlideImages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/user-usage-server", () => ({ authenticateRequest }));
vi.mock("@/lib/gamma/render", () => ({ renderPptxWithGamma }));
vi.mock("@/lib/ppt-image-resolver", async (orig) => ({ ...(await orig<object>()), generatePptDeckSlideImages }));
vi.mock("@/lib/lesson-plan-export", async (orig) => ({ ...(await orig<object>()), buildPptxFromPptContent }));

import { GammaError } from "@/lib/gamma/config";
import { GET, POST } from "./route";

const staging = {
  GAMMA_EXPERIMENT_ENABLED: "true",
  GAMMA_ENVIRONMENT_NAME: "staging",
  GAMMA_ALLOWED_ENVIRONMENTS: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123456789.supabase.co",
  GAMMA_ALLOWED_SUPABASE_REFS: "stagingref123456789",
  GAMMA_TESTER_EMAILS: "tester@x.com",
};
const setEnv = (e: Record<string, string>) => Object.entries(e).forEach(([k, v]) => vi.stubEnv(k, v));

const login = (email: string | null) =>
  authenticateRequest.mockResolvedValue({ ok: true, supabase: {}, userId: "user-1", accessToken: "t", email });

const post = (body: Record<string, unknown> = {}) =>
  POST(new Request("http://x/api/lesson-plan/export/pptx", {
    method: "POST",
    headers: { "x-forwarded-for": `9.9.9.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ subject: "Maths", grade: "Grade 8", topic: "Linear equations", pptContent: "Slide 1: Intro\nSolve 3x + 5 = 20", ...body }),
  }));

const gammaResult = {
  buffer: Buffer.from("PK-gamma"),
  validation: { verdict: "uncertain", reasons: [], uncertainties: ["x"], missing: [], modified: [], unexpected: [], numbers: { missing: [], unexpected: [] }, expectedSlides: 13, actualSlides: 13, matched: 40, pictures: 3 },
  metrics: { generationId: "g1", creditsDeducted: 12, resumed: false },
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  buildPptxFromPptContent.mockResolvedValue(Buffer.from("PK-legacy"));
  generatePptDeckSlideImages.mockResolvedValue({ urls: [] });
  renderPptxWithGamma.mockResolvedValue(gammaResult);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST: legacy behaviour is untouched unless the server gate opens", () => {
  it("default config ⇒ legacy renderer, Gamma never called, no Gamma headers", async () => {
    login("tester@x.com");
    const res = await post({ pptProvider: "gamma" });
    expect(res.status).toBe(200);
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
    expect(buildPptxFromPptContent).toHaveBeenCalledTimes(1);
    expect(res.headers.get("x-layah-ppt-provider")).toBeNull();
  });
  it("no pptProvider field ⇒ legacy even in staging with a tester", async () => {
    setEnv(staging);
    login("tester@x.com");
    await post();
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("non-tester asking for gamma in staging ⇒ legacy", async () => {
    setEnv(staging);
    login("someone@x.com");
    await post({ pptProvider: "gamma" });
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
    expect(buildPptxFromPptContent).toHaveBeenCalled();
  });
  it("production environment ⇒ legacy even for a tester with every flag set", async () => {
    setEnv({ ...staging, GAMMA_ENVIRONMENT_NAME: "production", GAMMA_ALLOWED_ENVIRONMENTS: "production" });
    login("tester@x.com");
    await post({ pptProvider: "gamma" });
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("unknown environment identity ⇒ legacy (fails closed)", async () => {
    setEnv({ ...staging, GAMMA_ENVIRONMENT_NAME: "" });
    login("tester@x.com");
    await post({ pptProvider: "gamma" });
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
  });
  it("uploaded-template mode never uses Gamma", async () => {
    setEnv(staging);
    login("tester@x.com");
    const res = await post({ pptProvider: "gamma", templateMode: "uploaded" });
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
    expect(res.status).not.toBe(200); // uploaded mode needs the template service; point is Gamma was not reached
  });
});

describe("POST: authorised tester in staging", () => {
  beforeEach(() => {
    setEnv(staging);
    login("tester@x.com");
  });
  it("gamma ⇒ Gamma renderer, no legacy image generation, report headers, original deck passed through", async () => {
    const res = await post({ pptProvider: "gamma" });
    expect(res.status).toBe(200);
    expect(renderPptxWithGamma).toHaveBeenCalledTimes(1);
    expect(generatePptDeckSlideImages).not.toHaveBeenCalled();
    expect(buildPptxFromPptContent).not.toHaveBeenCalled();
    expect(res.headers.get("x-layah-ppt-provider")).toBe("gamma");
    expect(res.headers.get("x-layah-gamma-validation")).toBe("uncertain");
    const report = JSON.parse(decodeURIComponent(res.headers.get("x-layah-gamma-report")!));
    expect(report).toMatchObject({ verdict: "uncertain", generationId: "g1", creditsDeducted: 12 });
    const call = renderPptxWithGamma.mock.calls[0][0];
    expect(call.deck).toHaveLength(13);
    expect(call.userId).toBe("user-1");
    expect(typeof call.startedAt).toBe("number");
  });
  it("the checkbox can select legacy even when the server default is gamma", async () => {
    vi.stubEnv("PPT_GENERATION_PROVIDER", "gamma");
    await post({ pptProvider: "legacy" });
    expect(renderPptxWithGamma).not.toHaveBeenCalled();
    expect(buildPptxFromPptContent).toHaveBeenCalled();
  });
  it("server default gamma applies when the client says nothing", async () => {
    vi.stubEnv("PPT_GENERATION_PROVIDER", "gamma");
    await post();
    expect(renderPptxWithGamma).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["poll_timeout", 504], ["submission_unknown", 409], ["generation_in_progress", 409], ["user_rate_limited", 429],
    ["budget_exceeded", 429], ["export_host_unconfigured", 503], ["store_unavailable", 503], ["missing_credentials", 503],
  ] as const)("maps GammaError %s to HTTP %i with a GAMMA_ code and no stack/secret", async (code, status) => {
    renderPptxWithGamma.mockRejectedValue(new GammaError(code, "safe message"));
    const res = await post({ pptProvider: "gamma" });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ code: `GAMMA_${code.toUpperCase()}`, error: "safe message" });
  });
});

describe("GET availability (drives the tester checkbox)", () => {
  const get = () => GET(new Request("http://x/api/lesson-plan/export/pptx"));
  it("reports unavailable by default", async () => {
    login("tester@x.com");
    expect(await (await get()).json()).toEqual({ gammaAvailable: false, defaultProvider: "legacy" });
  });
  it("reports availability and the server default for an authorised tester", async () => {
    setEnv({ ...staging, PPT_GENERATION_PROVIDER: "gamma" });
    login("tester@x.com");
    expect(await (await get()).json()).toEqual({ gammaAvailable: true, defaultProvider: "gamma" });
  });
  it("never reports gamma as the default to someone the gate rejects", async () => {
    setEnv({ ...staging, PPT_GENERATION_PROVIDER: "gamma" });
    login("someone@x.com");
    expect(await (await get()).json()).toEqual({ gammaAvailable: false, defaultProvider: "legacy" });
  });
  it("requires authentication", async () => {
    authenticateRequest.mockResolvedValue({ ok: false, status: 401, message: "no" });
    expect((await get()).status).toBe(401);
  });
});
