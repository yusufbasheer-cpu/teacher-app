import type { ValidationReport, Verdict } from "./validate";

export type GammaReportSummary = {
  verdict: Verdict;
  reasons: string[];
  uncertainties: string[];
  examples: string[];
  counts: { expectedSlides: number; actualSlides: number; matched: number; missing: number; modified: number; unexpected: number };
  pictures: number;
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
    ...r.missing.slice(0, 2).map((m) => `slide ${m.slide} missing: "${clip(m.text)}"`),
    ...r.modified.slice(0, 2).map((m) => `slide ${m.slide} changed: "${clip(m.expected, 40)}" → "${clip(m.found, 40)}"`),
    ...r.unexpected.slice(0, 2).map((m) => `slide ${m.slide} added: "${clip(m.text)}"`),
    ...r.numbers.missing.slice(0, 2).map((n) => `number missing: ${n}`),
    ...r.numbers.unexpected.slice(0, 2).map((n) => `number added: ${n}`),
  ].slice(0, 6);
  return {
    verdict: r.verdict,
    reasons: r.reasons,
    uncertainties: r.uncertainties,
    examples,
    counts: { expectedSlides: r.expectedSlides, actualSlides: r.actualSlides, matched: r.matched, missing: r.missing.length, modified: r.modified.length, unexpected: r.unexpected.length },
    pictures: r.pictures,
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
  /** passed: normal download. Otherwise the user must make an explicit "download anyway" choice. */
  normalDownload: boolean;
  downloadLabel: string;
  detail: string;
};

/** Pure UI decision logic (unit-tested): what the tester sees BEFORE any download is enabled. */
export function presentVerdict(s: GammaReportSummary | null): VerdictPresentation {
  if (!s) {
    return {
      title: "Validation result missing",
      tone: "bad",
      normalDownload: false,
      downloadLabel: "Download anyway (unvalidated)",
      detail: "The server did not return a validation report, so this deck cannot be treated as verified.",
    };
  }
  if (s.verdict === "passed") {
    return { title: "Content check passed", tone: "ok", normalDownload: true, downloadLabel: "Download PowerPoint", detail: `${s.counts.matched} text lines matched across ${s.counts.actualSlides} slides.` };
  }
  if (s.verdict === "uncertain") {
    return {
      title: "Content check inconclusive",
      tone: "warn",
      normalDownload: false,
      downloadLabel: "Download anyway (review manually)",
      detail: `No text changes were found, but the checker cannot verify: ${s.uncertainties.join("; ")}.`,
    };
  }
  return {
    title: "Content check FAILED: the lesson text was changed",
    tone: "bad",
    normalDownload: false,
    downloadLabel: "Download anyway (content differs)",
    detail: s.reasons.join("; "),
  };
}
