import { describe, expect, it } from "vitest";
import { decodeReportHeader, encodeReportHeader, presentVerdict, summariseReport } from "./report";
import { compareToSnapshot, extractPptx } from "./validate";
import { pptxFrom, sourceLines, sourceSnapshot } from "./test-helpers";

const reportFor = async (slides: Parameters<typeof pptxFrom>[0]) => compareToSnapshot(sourceSnapshot(), await extractPptx(await pptxFrom(slides)));

// Finding 10 — a validation result is always shown BEFORE a normal download is enabled.
describe("presentVerdict", () => {
  it("passed ⇒ normal download", async () => {
    const v = presentVerdict(summariseReport(await reportFor(sourceLines())));
    expect(v).toMatchObject({ tone: "ok", normalDownload: true, title: "Your slides are ready" });
  });
  it("wording-level differences are not shown to teachers (accepted), but stay in the report", async () => {
    const out = sourceLines().map((l, i) => (i === 1 ? [...l, "Invented"] : l));
    const s = summariseReport(await reportFor(out));
    expect(s.verdict).toBe("failed");
    expect(s.examples.join()).toContain("Invented");
    expect(presentVerdict(s)).toMatchObject({ tone: "ok", normalDownload: true, title: "Your slides are ready" });
    const u = summariseReport(await reportFor(sourceLines().map((paras, i) => ({ paras, chart: i === 0 }))));
    expect(u.verdict).toBe("uncertain");
    expect(presentVerdict(u)).toMatchObject({ tone: "ok", normalDownload: true });
  });
  it("a different slide count gets a gentle note but still downloads normally", async () => {
    const s = summariseReport(await reportFor(sourceLines().slice(1)));
    const v = presentVerdict(s);
    expect(v).toMatchObject({ tone: "warn", normalDownload: true });
    expect(v.detail).toMatch(/slides instead of/);
    expect(v.detail).not.toMatch(/validator|verdict|unexpected/i);
  });
  it("a missing/unparseable report is never presented as success", () => {
    expect(presentVerdict(null)).toMatchObject({ tone: "bad", normalDownload: false });
    expect(decodeReportHeader("%7Bnot-json")).toBeNull();
    expect(decodeReportHeader(null)).toBeNull();
    expect(decodeReportHeader(encodeURIComponent(JSON.stringify({ verdict: "great" })))).toBeNull();
  });
});

describe("report header transport", () => {
  it("round-trips, is ASCII-only and stays small even for large reports", async () => {
    const huge = sourceLines().map((l) => l.map((x) => `${x} — ünïcode ${"x".repeat(200)}`));
    const s = summariseReport(await reportFor(huge), { generationId: "g_1", creditsDeducted: 55, resumed: true });
    const h = encodeReportHeader(s);
    expect(h).toMatch(/^[\x20-\x7e]*$/);
    expect(h.length).toBeLessThanOrEqual(3500);
    const back = decodeReportHeader(h);
    expect(back).toMatchObject({ verdict: "failed", generationId: "g_1", creditsDeducted: 55, resumed: true });
  });
  it("examples are clipped, so slide text is not dumped wholesale", async () => {
    const s = summariseReport(await reportFor(sourceLines().map((l, i) => (i === 0 ? [...l, "z".repeat(500)] : l))));
    expect(Math.max(...s.examples.map((e) => e.length))).toBeLessThan(140);
  });
});
