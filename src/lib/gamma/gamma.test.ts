import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { acquireGammaRun, getSpentCredits, resetGammaBudgetForTests } from "./budget";
import { downloadGammaExport, runGammaGeneration } from "./client";
import { GammaError, getGammaConfig, resolvePptProvider, wantsGamma, type GammaConfig } from "./config";
import { buildGammaPayload, GAMMA_CARD_BREAK } from "./payload";
import { renderPptxWithGamma } from "./render";
import { compareToSnapshot, extractPptx } from "./validate";

const config: GammaConfig = {
  ...getGammaConfig({ GAMMA_API_KEY: "test-key-123" }),
  pollIntervalMs: 1,
  timeoutMs: 1_000,
};

function makeDeck(n = 13): StructuredLessonSlideModel[] {
  return Array.from({ length: n }, (_, i) => ({
    slideTitle: `Slide ${i + 1} Title`,
    body: i === 3 ? "Solve 3x + 5 = 20\nWhat is x?\n1. Subtract 5\n2. Divide by 3" : `Point A${i}\nPoint B${i} costs 12.5`,
    speakerNotes: "notes that must not be sent",
    includeImageSlot: true,
  }));
}

async function pptxFrom(slides: string[][], media = 0): Promise<Buffer> {
  const zip = new JSZip();
  const rels = slides
    .map((_, i) => `<Relationship Id="rId${i + 1}" Target="slides/slide${i + 1}.xml"/>`)
    .join("");
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships>${rels}</Relationships>`);
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst></p:presentation>`,
  );
  slides.forEach((paras, i) => {
    const xml = paras.map((t) => `<a:p><a:r><a:t>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a:t></a:r></a:p>`).join("");
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld>${xml}${i < media ? "<p:pic></p:pic>" : ""}</p:sld>`);
  });
  for (let i = 0; i < media; i++) zip.file(`ppt/media/image${i}.png`, "x");
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

function sourceSlides(deck = makeDeck()): string[][] {
  return buildGammaPayload({ deck, title: "t", language: "en", config }).snapshot.map((s) => s.lines);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => resetGammaBudgetForTests());

describe("provider selection / feature-flag isolation", () => {
  const tester = { GAMMA_EXPERIMENT_ENABLED: "true", GAMMA_TESTER_EMAILS: "T@x.com, b@x.com" };
  it("defaults to legacy", () => {
    expect(resolvePptProvider({ email: "t@x.com" }, {}).provider).toBe("legacy");
    expect(wantsGamma(undefined, {})).toBe(false);
  });
  it("ignores a gamma request when the experiment is off", () => {
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, { GAMMA_EXPERIMENT_ENABLED: "false", GAMMA_TESTER_EMAILS: "t@x.com" }).provider).toBe("legacy");
  });
  it("ignores gamma in Vercel production even for testers", () => {
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, { ...tester, VERCEL_ENV: "production" })).toMatchObject({ provider: "legacy", reason: "production-environment" });
  });
  it("rejects non-testers and anonymous callers", () => {
    expect(resolvePptProvider({ requested: "gamma", email: "other@x.com" }, tester).provider).toBe("legacy");
    expect(resolvePptProvider({ requested: "gamma", email: null }, tester).provider).toBe("legacy");
  });
  it("allows an allowlisted tester (case-insensitive), via request or env default", () => {
    expect(resolvePptProvider({ requested: "gamma", email: "t@x.com" }, tester).provider).toBe("gamma");
    expect(resolvePptProvider({ email: "b@x.com" }, { ...tester, PPT_GENERATION_PROVIDER: "gamma" }).provider).toBe("gamma");
  });
  it("treats unknown provider values as legacy", () => {
    expect(resolvePptProvider({ requested: "bogus", email: "t@x.com" }, tester).provider).toBe("legacy");
  });
});

describe("credentials", () => {
  it("throws a clear error without GAMMA_API_KEY", () => {
    expect(() => getGammaConfig({})).toThrowError(/GAMMA_API_KEY/);
    try {
      getGammaConfig({});
    } catch (e) {
      expect((e as GammaError).code).toBe("missing_credentials");
    }
  });
  it("legacy resolution never reads the key", () => {
    expect(() => resolvePptProvider({ email: "t@x.com" }, {})).not.toThrow();
  });
});

describe("request serialisation", () => {
  it("builds a preserve / inputTextBreaks request with one card per slide", () => {
    const { request, snapshot } = buildGammaPayload({ deck: makeDeck(), title: "G7 Maths", language: "en", config });
    expect(request).toMatchObject({ textMode: "preserve", format: "presentation", cardSplit: "inputTextBreaks", exportAs: "pptx", cardOptions: { dimensions: "16x9" } });
    expect(request).not.toHaveProperty("numCards");
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
    expect(snapshot).toHaveLength(13);
    expect(String(request.inputText)).not.toContain("notes that must not be sent");
    expect(String(request.additionalInstructions).length).toBeLessThanOrEqual(5000);
    expect(JSON.stringify(request)).not.toContain("test-key-123");
  });
  it("neutralises stray --- lines so they cannot create extra cards", () => {
    const deck = makeDeck();
    deck[2] = { ...deck[2], body: "before\n---\nafter" };
    const { request, neutralisedBreaks } = buildGammaPayload({ deck, title: "t", language: "en", config });
    expect(neutralisedBreaks).toBe(1);
    expect(String(request.inputText).split(GAMMA_CARD_BREAK)).toHaveLength(13);
  });
  it("only sends image model/style for aiGenerated", () => {
    const withModel = { ...config, imageModel: "m1", imageStyle: "flat" };
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: withModel }).request.imageOptions).toEqual({ source: "aiGenerated", model: "m1", style: "flat" });
    expect(buildGammaPayload({ deck: makeDeck(2), title: "t", language: "en", config: { ...withModel, imageSource: "noImages" } }).request.imageOptions).toEqual({ source: "noImages" });
  });
});

describe("async generation client", () => {
  const sleep = async () => {};
  it("submits once, polls until completed, returns credits", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (init?.method === "POST") return json({ generationId: "gen1" });
      return calls.filter((c) => c.startsWith("GET")).length < 3
        ? json({ status: "pending" })
        : json({ status: "completed", exportUrl: "https://assets.gamma.app/x.pptx", credits: { deducted: 42, remaining: 958 } });
    }) as unknown as typeof fetch;
    const r = await runGammaGeneration(config, {}, { fetchImpl, sleep });
    expect(r).toMatchObject({ generationId: "gen1", credits: { deducted: 42, remaining: 958 }, pollCount: 3 });
    expect(calls.filter((c) => c.startsWith("POST"))).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/generations"), expect.objectContaining({ headers: expect.objectContaining({ "X-API-KEY": "test-key-123" }) }));
  });
  it.each([
    [401, "invalid_credentials"],
    [402, "insufficient_credits"],
    [400, "bad_request"],
    [500, "api_error"],
  ])("maps create HTTP %i to %s and does not retry", async (status, code) => {
    const fetchImpl = vi.fn(async () => json({ message: "x" }, status)) as unknown as typeof fetch;
    await expect(runGammaGeneration(config, {}, { fetchImpl, sleep })).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("retries 429 on create at most twice, then reports rate_limited", async () => {
    const fetchImpl = vi.fn(async () => json({}, 429)) as unknown as typeof fetch;
    await expect(runGammaGeneration(config, {}, { fetchImpl, sleep })).rejects.toMatchObject({ code: "rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("reports a failed generation with its id, and credit exhaustion distinctly", async () => {
    const mk = (error: object) => vi.fn(async (_u: unknown, init?: RequestInit) => (init?.method === "POST" ? json({ generationId: "g2" }) : json({ status: "failed", error }))) as unknown as typeof fetch;
    await expect(runGammaGeneration(config, {}, { fetchImpl: mk({ message: "boom" }), sleep })).rejects.toMatchObject({ code: "generation_failed", extra: { generationId: "g2" } });
    await expect(runGammaGeneration(config, {}, { fetchImpl: mk({ message: "Insufficient credits" }), sleep })).rejects.toMatchObject({ code: "insufficient_credits" });
  });
  it("times out (without a second submission) when it stays pending", async () => {
    let t = 0;
    const fetchImpl = vi.fn(async (_u: unknown, init?: RequestInit) => (init?.method === "POST" ? json({ generationId: "g3" }) : json({ status: "pending" }))) as unknown as typeof fetch;
    await expect(runGammaGeneration(config, {}, { fetchImpl, sleep, now: () => (t += 400) })).rejects.toMatchObject({ code: "timeout", extra: { generationId: "g3" } });
    expect((fetchImpl as unknown as { mock: { calls: [unknown, RequestInit?][] } }).mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(1);
  });
  it("fails when completed without an export URL", async () => {
    const fetchImpl = vi.fn(async (_u: unknown, init?: RequestInit) => (init?.method === "POST" ? json({ generationId: "g4" }) : json({ status: "completed" }))) as unknown as typeof fetch;
    await expect(runGammaGeneration(config, {}, { fetchImpl, sleep })).rejects.toMatchObject({ code: "generation_failed" });
  });
});

describe("export download hardening", () => {
  const ok = async () => new Response(new Uint8Array(await pptxFrom([["a"]])), { status: 200 });
  it("downloads a valid zip from an allowed https host without sending the API key", async () => {
    const fetchImpl = vi.fn(ok) as unknown as typeof fetch;
    const buf = await downloadGammaExport(config, "https://cdn.gamma.app/f.pptx", { fetchImpl });
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(JSON.stringify((fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1])).not.toContain("test-key");
  });
  it.each(["http://cdn.gamma.app/f.pptx", "https://evil.example.com/f.pptx", "https://gamma.app.evil.com/f.pptx", "not a url"])("rejects %s", async (u) => {
    await expect(downloadGammaExport(config, u, { fetchImpl: vi.fn(ok) as unknown as typeof fetch })).rejects.toMatchObject({ code: "download_rejected" });
  });
  it("rejects redirects, oversize bodies and non-zip content", async () => {
    const redirect = (async () => new Response(null, { status: 302, headers: { location: "https://evil.com" } })) as unknown as typeof fetch;
    await expect(downloadGammaExport(config, "https://a.gamma.app/f", { fetchImpl: redirect })).rejects.toMatchObject({ code: "download_rejected" });
    const big = (async () => new Response(new Uint8Array(100), { status: 200 })) as unknown as typeof fetch;
    await expect(downloadGammaExport({ ...config, maxDownloadBytes: 10 }, "https://a.gamma.app/f", { fetchImpl: big })).rejects.toMatchObject({ code: "download_rejected" });
    const html = (async () => new Response("<html>nope</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(downloadGammaExport(config, "https://a.gamma.app/f", { fetchImpl: html })).rejects.toMatchObject({ code: "invalid_export" });
  });
});

describe("content-preservation validation", () => {
  it("passes when the PPTX text equals the source, ignoring bullet markers / whitespace", async () => {
    const src = sourceSlides();
    const out = src.map((lines) => lines.map((l) => (l.startsWith("Point") ? `  ${l}   ` : l)));
    const report = compareToSnapshot(buildGammaPayload({ deck: makeDeck(), title: "t", language: "en", config }).snapshot, await extractPptx(await pptxFrom(out, 5)));
    expect(report.reasons).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.pictures).toBe(5);
    expect(report.mediaFiles).toBe(5);
  });
  const snap = () => buildGammaPayload({ deck: makeDeck(), title: "t", language: "en", config }).snapshot;
  it("flags a changed number and a changed operator (3x + 5 → 3x − 5)", async () => {
    const out = sourceSlides().map((l) => l.map((x) => x.replace("3x + 5 = 20", "3x - 5 = 25")));
    const r = compareToSnapshot(snap(), await extractPptx(await pptxFrom(out)));
    expect(r.passed).toBe(false);
    expect(r.modified.length + r.missing.length).toBeGreaterThan(0);
    expect(r.numbers.missing).toContain("20");
    expect(r.numbers.unexpected).toContain("25");
    expect(r.operators.missing).toContain("+");
  });
  it("flags missing questions, unexpected text, missing slides and moved lines", async () => {
    const out = sourceSlides();
    out[3] = out[3].filter((l) => !l.endsWith("?"));
    out[0].push("Fun fact: Gamma invented this sentence");
    const r = compareToSnapshot(snap(), await extractPptx(await pptxFrom(out.slice(0, 12))));
    expect(r.passed).toBe(false);
    expect(r.questions.missing).toContain("What is x?");
    expect(r.unexpected.some((u) => u.text.startsWith("Fun fact"))).toBe(true);
    expect(r.reasons.join()).toMatch(/slide count 12/);
  });
  it("detects a line that landed on the wrong slide", async () => {
    const out = sourceSlides();
    const line = out[1].pop()!;
    out[2].push(line);
    const r = compareToSnapshot(snap(), await extractPptx(await pptxFrom(out)));
    expect(r.movedBetweenSlides[0]).toMatchObject({ expectedSlide: 2, foundSlide: 3 });
    expect(r.passed).toBe(false);
  });
});

describe("render orchestration (mocked Gamma)", () => {
  const route = (pptx: Buffer, deducted = 55) =>
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === "POST") return json({ generationId: "gX" });
      if (u.includes("/generations/")) return json({ status: "completed", exportUrl: "https://files.gamma.app/o.pptx", credits: { deducted, remaining: 100 } });
      return new Response(new Uint8Array(pptx), { status: 200 });
    }) as unknown as typeof fetch;
  const sleep = async () => {};

  it("returns a validated deck, records credits and logs metrics without content or secrets", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const pptx = await pptxFrom(sourceSlides(), 11);
    const r = await renderPptxWithGamma({ deck: makeDeck(), title: "t", language: "en", userId: "u1", config }, { fetchImpl: route(pptx), sleep });
    expect(r.metrics).toMatchObject({ outcome: "success", validation: "passed", requestedSlides: 13, actualSlides: 13, creditsDeducted: 55, imagesPictureCount: 11, generationId: "gX" });
    expect(getSpentCredits()).toBe(55);
    const logged = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("[gamma-ppt]");
    expect(logged).not.toMatch(/test-key-123|files\.gamma\.app|Point A0/);
    log.mockRestore();
  });
  it("flags (does not hide) a deck that changed content", async () => {
    const changed = sourceSlides().map((l) => l.map((x) => x.replace("12.5", "13.5")));
    const r = await renderPptxWithGamma({ deck: makeDeck(), title: "t", language: "en", userId: "u1", config }, { fetchImpl: route(await pptxFrom(changed)), sleep });
    expect(r.metrics.validation).toBe("failed");
    expect(r.validation.numbers.unexpected).toContain("13.5");
  });
  it("blocks a duplicate in-flight generation and releases the lock afterwards", async () => {
    const pptx = await pptxFrom(sourceSlides());
    let unblock = () => {};
    const gate = new Promise<void>((r) => (unblock = r));
    const slow = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        await gate;
        return json({ generationId: "gS" });
      }
      return route(pptx)(url, init);
    }) as unknown as typeof fetch;
    const args = { deck: makeDeck(), title: "t", language: "en" as const, userId: "u1", config };
    const first = renderPptxWithGamma(args, { fetchImpl: slow, sleep });
    await expect(renderPptxWithGamma(args, { fetchImpl: slow, sleep })).rejects.toMatchObject({ code: "duplicate_in_flight" });
    unblock();
    await first;
    await expect(renderPptxWithGamma(args, { fetchImpl: route(pptx), sleep })).resolves.toBeTruthy();
  });
  it("releases the lock on failure", async () => {
    const bad = vi.fn(async () => json({}, 402)) as unknown as typeof fetch;
    const args = { deck: makeDeck(), title: "t", language: "en" as const, userId: "u1", config };
    await expect(renderPptxWithGamma(args, { fetchImpl: bad, sleep })).rejects.toMatchObject({ code: "insufficient_credits" });
    await expect(renderPptxWithGamma(args, { fetchImpl: bad, sleep })).rejects.toMatchObject({ code: "insufficient_credits" });
  });
});

describe("spending safeguards", () => {
  it("rejects oversized decks and an exhausted experiment budget", () => {
    expect(() => acquireGammaRun("k", 26, config)).toThrowError(/GAMMA_MAX_CARDS_PER_RUN/);
    const tiny = { ...config, experimentCreditBudget: 1 };
    // spend past the tiny budget via a successful-looking run
    const release = acquireGammaRun("k2", 5, tiny);
    release();
    return import("./budget").then(({ recordCredits }) => {
      recordCredits(5);
      expect(() => acquireGammaRun("k3", 5, tiny)).toThrowError(/budget/);
    });
  });
});
