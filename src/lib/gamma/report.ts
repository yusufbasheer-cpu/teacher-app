import type { ValidationReport, Verdict } from "./validate";

export type GammaReportSummary = {
  verdict: Verdict;
  reasons: string[];
  uncertainties: string[];
  examples: string[];
  counts: { expectedSlides: number; actualSlides: number; matched: number; missing: number; modified: number; unexpected: number };
  pictures: number;
  /** Image-dominance review notes (separate from the content verdict); slide numbers are 1-based. */
  layout?: { picturesOnTextOnlySlides: number[]; crowdedSlides: number[] };
  requiredVisuals?: { verdict: "passed" | "uncertain" | "failed"; missing: string[]; unverified: string[] };
  generationId?: string;
  creditsDeducted?: number;
  resumed?: boolean;
};

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function summariseReport(
  r: ValidationReport,
  meta: { generationId?: string; creditsDeducted?: number; resumed?: boolean } = {},
): GammaReportSummary {
  const examples = [
    ...r.modified.slice(0, 2).map((m) => `Slide ${m.slide}: "${clip(m.expected, 40)}" became "${clip(m.found, 40)}"`),
    ...r.missing.slice(0, 2).map((m) => `Slide ${m.slide}: missing "${clip(m.text)}"`),
    ...r.unexpected.slice(0, 2).map((m) => `Slide ${m.slide}: added "${clip(m.text)}"`),
    ...r.numbers.missing.slice(0, 2).map((n) => `Number missing: ${n}`),
    ...r.numbers.unexpected.slice(0, 2).map((n) => `Number added: ${n}`),
  ].slice(0, 6);
  return {
    verdict: r.verdict,
    reasons: r.reasons,
    uncertainties: r.uncertainties,
    examples,
    counts: { expectedSlides: r.expectedSlides, actualSlides: r.actualSlides, matched: r.matched, missing: r.missing.length, modified: r.modified.length, unexpected: r.unexpected.length },
    pictures: r.pictures,
    ...(r.layout ? { layout: { picturesOnTextOnlySlides: r.layout.picturesOnTextOnlySlides.map((f) => f.slide), crowdedSlides: r.layout.crowdedSlides.map((f) => f.slide) } } : {}),
    ...(r.requiredVisuals ? {
      requiredVisuals: {
        verdict: r.requiredVisuals.verdict,
        missing: r.requiredVisuals.categories.filter((item) => item.status === "missing").map((item) => item.category),
        unverified: r.requiredVisuals.categories.filter((item) => item.status === "unverified").map((item) => item.category),
      },
    } : {}),
    ...meta,
  };
}

/** Header-safe (ASCII) JSON; stays under typical 8 KB header limits by dropping examples first. */
export function encodeReportHeader(s: GammaReportSummary): string {
  let enc = encodeURIComponent(JSON.stringify(s));
  if (enc.length > 3500) enc = encodeURIComponent(JSON.stringify({ ...s, examples: [] }));
  if (enc.length > 3500) enc = encodeURIComponent(JSON.stringify({ ...s, examples: [], reasons: s.reasons.slice(0, 3), uncertainties: s.uncertainties.slice(0, 2) }));
  return enc;
}

export function decodeReportHeader(h: string | null): GammaReportSummary | null {
  if (!h) return null;
  try {
    const v = JSON.parse(decodeURIComponent(h)) as GammaReportSummary;
    return v && (v.verdict === "passed" || v.verdict === "failed" || v.verdict === "uncertain") ? v : null;
  } catch {
    return null;
  }
}

export type VerdictPresentation = {
  title: string;
  tone: "ok" | "warn" | "bad";
  /** True: the file downloads straight away. False: the teacher must choose "Download anyway". */
  normalDownload: boolean;
  downloadLabel: string;
  detail: string;
};

/**
 * Pure UI decision logic (unit-tested). Teacher-facing copy: no validator jargon. A passed or merely "review"
 * deck downloads automatically; only a structurally wrong deck (or no report at all) needs an explicit choice.
 */
export function presentVerdict(s: GammaReportSummary | null): VerdictPresentation {
  if (!s) {
    return {
      title: "We couldn't check your slides",
      tone: "bad",
      normalDownload: false,
      downloadLabel: "Download anyway",
      detail: "Your presentation was made, but we couldn't confirm it matches your lesson. Please look through it before class.",
    };
  }
  if (s.verdict === "passed") {
    if (s.requiredVisuals && s.requiredVisuals.verdict !== "passed") {
      const missing = s.requiredVisuals.missing.length
        ? ` Missing required pictures: ${s.requiredVisuals.missing.join(", ")}.`
        : " Picture relevance could not be verified automatically.";
      return {
        title: "Your slides are ready — check the pictures",
        tone: "warn",
        normalDownload: true,
        downloadLabel: "Download again",
        detail: `Your lesson wording was preserved.${missing}`,
      };
    }
    return { title: "Your slides are ready", tone: "ok", normalDownload: true, downloadLabel: "Download again", detail: `${s.counts.actualSlides} slides, designed and downloaded.` };
  }
  if (s.verdict === "uncertain") {
    return {
      title: "Your slides are ready — give them a quick look",
      tone: "warn",
      normalDownload: true,
      downloadLabel: "Download again",
      detail: "Some wording was shortened to fit the slides. Read through them once before class.",
    };
  }
  return {
    title: "Some slides didn't come out right",
    tone: "bad",
    normalDownload: false,
    downloadLabel: "Download anyway",
    detail: s.counts.actualSlides !== s.counts.expectedSlides
      ? `The design has ${s.counts.actualSlides} slides instead of ${s.counts.expectedSlides}. You can download it and check it, or pick another theme for a fresh design.`
      : "Some of your lesson text is missing or changed on the designed slides. You can download it and check it, or pick another theme for a fresh design.",
  };
}
