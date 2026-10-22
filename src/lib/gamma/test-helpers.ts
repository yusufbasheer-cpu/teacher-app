import JSZip from "jszip";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import { getGammaConfig, type GammaConfig } from "./config";
import { buildGammaPayload } from "./payload";

export const EXPORT_HOST = "files.gamma-test.example";

export function testConfig(over: Partial<GammaConfig> = {}): GammaConfig {
  return {
    ...getGammaConfig({ GAMMA_API_KEY: "test-key-123", GAMMA_EXPORT_HOST_ALLOWLIST: `${EXPORT_HOST},*.cdn.gamma-test.example` }),
    pollIntervalMs: 5_000,
    requestTimeoutMs: 40,
    pollTimeoutMs: 60_000,
    overallBudgetMs: 150_000,
    userHourlyLimit: 50,
    userDailyLimit: 50,
    dailyCreditBudget: 100_000,
    monthlyCreditBudget: 100_000,
    estimatedCreditsPerRun: 60,
    ...over,
  };
}

/** Deterministic clock: `sleep` advances time instead of waiting. */
export function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

export function makeDeck(n = 13, tag = ""): StructuredLessonSlideModel[] {
  return Array.from({ length: n }, (_, i) => ({
    slideTitle: `Slide ${i + 1} Title${tag}`,
    body: i === 3 ? "Solve 3x + 5 = 20\nWhat is x?\n1. Subtract 5\n2. Divide by 3" : `Point A${i}\nPoint B${i} costs 12.5`,
    speakerNotes: "notes that must not be sent",
    includeImageSlot: true,
  }));
}

export type ParaSpec = string | { text: string; autoNum?: string; startAt?: number; br?: "self" | "wrapped" };
export type SlideSpec = {
  paras: ParaSpec[];
  /** Adds a slide-number placeholder shape containing this text. */
  sldNumPlaceholder?: string;
  /** Adds a slide-number FIELD paragraph inside a normal text box. */
  sldNumField?: string;
  chart?: boolean;
  pic?: boolean;
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function paraXml(p: ParaSpec): string {
  const o = typeof p === "string" ? { text: p } : p;
  const pPr = o.autoNum ? `<a:pPr marL="342900" indent="-342900"><a:buAutoNum type="${o.autoNum}"${o.startAt ? ` startAt="${o.startAt}"` : ""}/></a:pPr>` : "";
  const br = o.br === "wrapped" ? '<a:br><a:rPr lang="en-US"/></a:br>' : "<a:br/>";
  const runs = o.text.split("\n").map((seg) => `<a:r><a:t>${esc(seg)}</a:t></a:r>`).join(br);
  return `<a:p>${pPr}${runs}</a:p>`;
}

export async function pptxFrom(slides: (ParaSpec[] | SlideSpec)[], media = 0): Promise<Buffer> {
  const zip = new JSZip();
  const specs: SlideSpec[] = slides.map((s) => (Array.isArray(s) ? { paras: s } : s));
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships>${specs.map((_, i) => `<Relationship Id="rId${i + 1}" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`);
  zip.file("ppt/presentation.xml", `<p:presentation><p:sldIdLst>${specs.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst></p:presentation>`);
  specs.forEach((s, i) => {
    const body = `<p:sp><p:txBody>${s.paras.map(paraXml).join("")}${s.sldNumField ? `<a:p><a:fld id="{1}" type="slidenum"><a:t>${s.sldNumField}</a:t></a:fld></a:p>` : ""}</p:txBody></p:sp>`;
    const num = s.sldNumPlaceholder ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${s.sldNumPlaceholder}</a:t></a:r></a:p></p:txBody></p:sp>` : "";
    const chart = s.chart ? '<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></p:graphicFrame>' : "";
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld>${body}${num}${chart}${s.pic || i < media ? "<p:pic></p:pic>" : ""}</p:sld>`);
  });
  for (let i = 0; i < media; i++) zip.file(`ppt/media/image${i}.png`, "x");
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

export function sourceSnapshot(deck = makeDeck()) {
  return buildGammaPayload({ deck, title: "t", language: "en", config: testConfig() }).snapshot;
}
export const sourceLines = (deck = makeDeck()) => sourceSnapshot(deck).map((s) => s.lines);

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export type FakeGammaOpts = {
  pptx: Buffer;
  /** Status polls that answer "pending" before completing. */
  pendingPolls?: number;
  create?: "ok" | "stall" | "http500" | "noid" | "http402" | "http400" | "http429";
  credits?: number;
  exportHost?: string;
  /** Awaited inside the create call (to hold a request open in concurrency tests). */
  gate?: Promise<void>;
  statusStall?: boolean;
  downloadType?: string;
};

/** Stateful stand-in for the Gamma API + export host. Honours AbortSignal like real fetch. */
export function fakeGamma(opts: FakeGammaOpts) {
  const state = { posts: 0, gets: 0, downloads: 0, signalsSeen: [] as boolean[], pendingPolls: opts.pendingPolls ?? 0, opts };
  const abortable = (signal: AbortSignal | null | undefined) =>
    new Promise<Response>((_, reject) => {
      signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
    });
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    state.signalsSeen.push(Boolean(init?.signal));
    if (u.includes("/generations") && init?.method === "POST") {
      state.posts++;
      if (state.opts.gate) await state.opts.gate;
      switch (state.opts.create ?? "ok") {
        case "stall": return abortable(init.signal);
        case "http500": return json({ message: "boom" }, 500);
        case "noid": return json({});
        case "http402": return json({ message: "credits" }, 402);
        case "http400": return json({ message: "bad" }, 400);
        case "http429": return json({}, 429, { "retry-after": "1" });
        default: return json({ generationId: `gen-${state.posts}` });
      }
    }
    if (u.includes("/generations/")) {
      state.gets++;
      if (state.opts.statusStall) return abortable(init?.signal);
      if (state.pendingPolls > 0) {
        state.pendingPolls--;
        return json({ status: "pending" });
      }
      return json({ status: "completed", gammaUrl: "https://gamma.app/docs/x", exportUrl: `https://${state.opts.exportHost ?? EXPORT_HOST}/o.pptx?sig=SECRET-SIG`, credits: { deducted: state.opts.credits ?? 55, remaining: 900 } });
    }
    state.downloads++;
    return new Response(new Uint8Array(state.opts.pptx), { status: 200, headers: { "content-type": state.opts.downloadType ?? "application/octet-stream" } });
  }) as unknown as typeof fetch;
  return { state, fetchImpl };
}

export const publicResolver = async () => ["93.184.216.34"];
