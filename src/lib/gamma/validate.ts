import JSZip from "jszip";
import type { RequiredVisualCoverageReport } from "@/lib/ppt-visual-intent";
import { LEARNING_OBJECTIVES_SLIDE_INDEX } from "@/lib/ppt-structured-lesson";
import type { SlideSnapshot } from "./payload";

export type ExtractedParagraph = {
  text: string;
  /** True when the visible number came from <a:buAutoNum> metadata and was reconstructed into `text`. */
  autoNumbered: boolean;
};
export type ExtractedSlide = {
  paragraphs: ExtractedParagraph[];
  pictures: number;
  /** Charts / diagrams / embedded objects: text that this extractor cannot see. */
  opaqueContent: boolean;
};
export type ExtractedDeck = {
  slides: ExtractedSlide[];
  mediaFiles: number;
  /** Auto-number schemes we could not reconstruct (e.g. circled digits). */
  unsupportedNumbering: string[];
};

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : "";
    }
    return XML_ENTITIES[e.toLowerCase()] ?? "";
  });
}

function toAlpha(n: number, upper: boolean): string {
  let s = "";
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(97 + ((k - 1) % 26)) + s;
  return upper ? s.toUpperCase() : s;
}
function toRoman(n: number, upper: boolean): string {
  const map: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let s = "";
  for (const [v, r] of map) while (n >= v) { s += r; n -= v; }
  return upper ? s.toUpperCase() : s;
}

/** Builds the visible marker for an <a:buAutoNum type="..."> paragraph, or null if the scheme is unsupported. */
export function autoNumberLabel(scheme: string, n: number): string | null {
  const m = /^(arabic|alphaLc|alphaUc|romanLc|romanUc)(Period|ParenR|ParenBoth|Plain)$/.exec(scheme);
  if (!m) return null;
  const core = m[1] === "arabic" ? String(n) : m[1] === "alphaLc" ? toAlpha(n, false) : m[1] === "alphaUc" ? toAlpha(n, true) : toRoman(n, m[1] === "romanUc");
  return m[2] === "Period" ? `${core}.` : m[2] === "ParenR" ? `${core})` : m[2] === "ParenBoth" ? `(${core})` : core;
}

type RawPara = { text: string; num?: { scheme: string; startAt: number }; lvl: number };

function parseParagraphs(slideXml: string, unsupported: Set<string>): ExtractedParagraph[] {
  // Slide-number placeholders are page furniture, not content (identified structurally, never by text length).
  const xml = slideXml.replace(/<p:sp\b(?:(?!<\/p:sp>)[\s\S])*?<p:ph\b[^>]*\btype="sldNum"[\s\S]*?<\/p:sp>/g, "");
  const raw: RawPara[] = [];
  for (const p of xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    // Slide-number FIELDS inside an otherwise normal text box are removed too.
    const inner = p[1].replace(/<a:fld\b[^>]*\btype="slidenum"[^>]*>[\s\S]*?<\/a:fld>/gi, "");
    const pPr = /<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>|<a:pPr\b[^>]*\/>/.exec(inner)?.[0] ?? "";
    const auto = /<a:buAutoNum\b([^>]*)\/?>/.exec(pPr);
    const scheme = auto ? /\btype="([^"]+)"/.exec(auto[1])?.[1] ?? "arabicPeriod" : undefined;
    const startAt = auto ? Number(/\bstartAt="(\d+)"/.exec(auto[1])?.[1] ?? "1") : 1;
    const lvl = Number(/\blvl="(\d+)"/.exec(pPr)?.[0].replace(/\D/g, "") ?? "0");
    // <a:br/> and <a:br><a:rPr/></a:br> are both soft line breaks.
    const tokens = inner.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>|<a:br\b[^>]*>[\s\S]*?<\/a:br>/g);
    let text = "";
    for (const t of tokens) text += t[1] === undefined ? "\n" : decode(t[1]);
    if (!text.trim()) continue;
    raw.push({ text, ...(scheme ? { num: { scheme, startAt } } : {}), lvl });
  }
  // Reconstruct auto-numbers: a run of consecutive numbered paragraphs of the same scheme+level counts up.
  const out: ExtractedParagraph[] = [];
  let prev: { scheme: string; lvl: number; n: number } | null = null;
  for (const r of raw) {
    if (!r.num) {
      prev = null;
      out.push({ text: r.text, autoNumbered: false });
      continue;
    }
    const n: number = prev && prev.scheme === r.num.scheme && prev.lvl === r.lvl ? prev.n + 1 : r.num.startAt;
    prev = { scheme: r.num.scheme, lvl: r.lvl, n };
    const label = autoNumberLabel(r.num.scheme, n);
    if (label === null) {
      unsupported.add(r.num.scheme);
      out.push({ text: r.text, autoNumbered: false });
    } else {
      out.push({ text: r.text.trim().startsWith(label) ? r.text : `${label} ${r.text.trim()}`, autoNumbered: true });
    }
  }
  return out;
}

/** Slides in presentation order (presentation.xml sldIdLst → rels), not file-name order. */
export async function extractPptx(buffer: Buffer): Promise<ExtractedDeck> {
  const zip = await JSZip.loadAsync(buffer);
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const rels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!pres || !rels) throw new Error("Not a PPTX: missing presentation.xml");
  const targetById = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) targetById.set(id, target);
  }
  const order = [...pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)].map((m) => m[1]);
  const unsupported = new Set<string>();
  const slides: ExtractedSlide[] = [];
  for (const rid of order) {
    const target = targetById.get(rid);
    const path = target ? `ppt/${target.replace(/^\/?(ppt\/)?/, "")}` : "";
    const xml = path ? await zip.file(path)?.async("string") : undefined;
    if (!xml) throw new Error(`Slide part missing for ${rid}`);
    slides.push({
      paragraphs: parseParagraphs(xml, unsupported),
      pictures: (xml.match(/<p:pic\b/g) ?? []).length,
      opaqueContent: /drawingml\/2006\/(chart|diagram)|<p:oleObj\b/.test(xml),
    });
  }
  const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith("ppt/media/") && !zip.files[n].dir).length;
  return { slides, mediaFiles, unsupportedNumbering: [...unsupported] };
}

/**
 * Presentation-equivalent normalisation ONLY: whitespace, NBSP, markdown emphasis wrappers and
 * leading unordered bullet / heading markers. Punctuation, digits and operators are preserved.
 */
export function normalise(s: string): string {
  return s
    .replace(/[ ​‎‏]/g, " ")
    .replace(/^\s*(?:[-*•▪◦‣●]\s+|#{1,6}\s+)/, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDERED_MARKER = /^(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]\s+|^\(\d+\)\s+/;
const stripOrderedMarker = (s: string) => s.replace(ORDERED_MARKER, "");
const stripNumericMarker = (s: string) => s.replace(/^\d+[.)]\s+/, "");

const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
const OPERATOR_RE = /[+−×÷=<>^/%√±≤≥≠≈]|(?<=\d|\s)-(?=\d|\s)/g;

function tally(text: string, re: RegExp): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of text.match(re) ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function diffTally(src: Map<string, number>, out: Map<string, number>) {
  const missing: string[] = [];
  const unexpected: string[] = [];
  for (const [k, n] of src) if ((out.get(k) ?? 0) < n) missing.push(k);
  for (const [k, n] of out) if ((src.get(k) ?? 0) < n) unexpected.push(k);
  return { missing, unexpected };
}

function similarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(" "));
  const tb = new Set(b.toLowerCase().split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(1, Math.min(ta.size, tb.size));
}

/** Exact containment, or containment once an ordered-list marker is ignored (reported as a soft finding). */
function findLine(hay: string, line: string, from = 0): { pos: number; markerOnly: boolean; conflict: boolean; found: string } | null {
  const exact = hay.indexOf(line, from);
  if (exact >= 0) return { pos: exact, markerOnly: false, conflict: false, found: line };
  const bare = stripOrderedMarker(line);
  if (bare !== line && bare.length > 0) {
    const p = hay.indexOf(bare, from);
    if (p >= 0) {
      // A DIFFERENT marker right before the same text ("2. Subtract 5" for "1. Subtract 5") is visible drift, not just formatting.
      const marker = /(?:^|\s)(\(?\d+[.)]|\([a-z]\)|[a-zA-Z][.)])\s$/.exec(hay.slice(Math.max(0, p - 8), p))?.[1];
      return { pos: p, markerOnly: true, conflict: marker !== undefined, found: marker ? `${marker} ${bare}` : bare };
    }
  }
  return null;
}

export type ModifiedText = { slide: number; expected: string; found: string };
export type Verdict = "passed" | "failed" | "uncertain";

export type ValidationReport = {
  /** passed: nothing differs. failed: evidence the content changed. uncertain: only things this validator cannot judge. */
  verdict: Verdict;
  /** Convenience: verdict === "passed". */
  passed: boolean;
  expectedSlides: number;
  actualSlides: number;
  matched: number;
  missing: { slide: number; text: string }[];
  modified: ModifiedText[];
  unexpected: { slide: number; text: string }[];
  movedBetweenSlides: { text: string; expectedSlide: number; foundSlide: number }[];
  reorderedOnSlide: number[];
  numbers: { missing: string[]; unexpected: string[] };
  operators: { missing: string[]; unexpected: string[] };
  questions: { total: number; preserved: number; missing: string[] };
  learningObjectivesPreserved: boolean | null;
  pictures: number;
  mediaFiles: number;
  /** Evidence that content changed (drives verdict "failed"). */
  reasons: string[];
  /** Validator limitations (drive verdict "uncertain" when there are no reasons). */
  uncertainties: string[];
  /** Image-dominance review notes; reported separately and never part of the verdict. */
  layout?: LayoutReport;
  /** Speaker notes written into the exported PPTX (Gamma exports none of its own). */
  speakerNotes?: { added: boolean; slidesWithNotes: number; totalSlides: number; reason?: string };
  /** Independent from the educational-content verdict. */
  requiredVisuals?: RequiredVisualCoverageReport;
};

export function compareToSnapshot(snapshot: SlideSnapshot[], actual: ExtractedDeck): ValidationReport {
  const expectedLines = snapshot.map((s) => s.lines.map(normalise).filter(Boolean));
  const actualParas = actual.slides.map((s) => s.paragraphs.map((p) => normalise(p.text)).filter(Boolean));
  const actualJoined = actualParas.map((p) => p.join(" "));
  const expectedJoined = expectedLines.map((l) => l.join(" "));

  const missing: ValidationReport["missing"] = [];
  const modified: ModifiedText[] = [];
  const unexpected: ValidationReport["unexpected"] = [];
  const moved: ValidationReport["movedBetweenSlides"] = [];
  const reordered: number[] = [];
  const markerSlides = new Set<number>();
  let matched = 0;

  const slides = Math.min(snapshot.length, actual.slides.length);
  for (let i = 0; i < slides; i++) {
    const unexpectedHere = actualParas[i].filter((p) => !expectedJoined[i].includes(p) && !expectedJoined[i].includes(stripOrderedMarker(p)));
    for (const p of actualParas[i]) if (!expectedJoined[i].includes(p) && expectedJoined[i].includes(stripOrderedMarker(p))) markerSlides.add(i + 1);
    const claimed = new Set<number>();
    let cursor = 0;
    let outOfOrder = false;
    for (const line of expectedLines[i]) {
      const hit = findLine(actualJoined[i], line, cursor);
      if (hit?.conflict) {
        modified.push({ slide: i + 1, expected: line, found: hit.found });
        cursor = hit.pos + 1;
        continue;
      }
      if (hit) {
        matched++;
        cursor = hit.pos + 1;
        if (hit.markerOnly) markerSlides.add(i + 1);
        continue;
      }
      const anywhere = findLine(actualJoined[i], line, 0);
      if (anywhere) {
        matched++;
        outOfOrder = true;
        if (anywhere.markerOnly) markerSlides.add(i + 1);
        continue;
      }
      const elsewhere = actualJoined.findIndex((j, k) => k !== i && findLine(j, line) !== null);
      if (elsewhere >= 0) {
        moved.push({ text: line, expectedSlide: i + 1, foundSlide: elsewhere + 1 });
        continue;
      }
      const best = unexpectedHere
        .map((p, idx) => ({ p, idx, score: similarity(line, p) }))
        .filter((c) => !claimed.has(c.idx) && c.score >= 0.6)
        .sort((a, b) => b.score - a.score)[0];
      if (best) {
        claimed.add(best.idx);
        modified.push({ slide: i + 1, expected: line, found: best.p });
      } else {
        missing.push({ slide: i + 1, text: line });
      }
    }
    if (outOfOrder) reordered.push(i + 1);
    unexpectedHere.forEach((p, idx) => {
      if (!claimed.has(idx)) unexpected.push({ slide: i + 1, text: p });
    });
  }
  for (let i = slides; i < actual.slides.length; i++) actualParas[i].forEach((t) => unexpected.push({ slide: i + 1, text: t }));
  for (let i = slides; i < snapshot.length; i++) expectedLines[i].forEach((t) => missing.push({ slide: i + 1, text: t }));

  // Numeric/operator tallies ignore leading "1." list markers (handled above as a soft finding, or reconstructed from buAutoNum).
  const strip = (lines: string[][]) => lines.map((l) => l.map(stripNumericMarker).join(" ")).join(" ");
  const srcAll = strip(expectedLines);
  const outAll = strip(actualParas);
  const numbers = diffTally(tally(srcAll, NUMBER_RE), tally(outAll, NUMBER_RE));
  const operators = diffTally(tally(srcAll, OPERATOR_RE), tally(outAll, OPERATOR_RE));

  const anywhere = actualJoined.join(" ");
  const questionLines = expectedLines.flat().filter((l) => /[?؟]\s*$/.test(l));
  const missingQuestions = questionLines.filter((q) => findLine(anywhere, q) === null);
  const lo = expectedLines[LEARNING_OBJECTIVES_SLIDE_INDEX];
  const learningObjectivesPreserved =
    lo && actualJoined[LEARNING_OBJECTIVES_SLIDE_INDEX] !== undefined
      ? lo.every((l) => findLine(actualJoined[LEARNING_OBJECTIVES_SLIDE_INDEX], l) !== null)
      : null;

  const reasons: string[] = [];
  if (snapshot.length !== actual.slides.length) reasons.push(`slide count ${actual.slides.length} ≠ expected ${snapshot.length}`);
  if (missing.length) reasons.push(`${missing.length} missing text line(s)`);
  if (modified.length) reasons.push(`${modified.length} modified text line(s)`);
  if (unexpected.length) reasons.push(`${unexpected.length} unexpected text line(s)`);
  if (moved.length) reasons.push(`${moved.length} line(s) on a different slide`);
  if (reordered.length) reasons.push(`lines reordered on slide(s) ${reordered.join(", ")}`);
  if (numbers.missing.length || numbers.unexpected.length) reasons.push("numeric values differ");
  if (operators.missing.length || operators.unexpected.length) reasons.push("operators/symbols differ");
  if (missingQuestions.length) reasons.push(`${missingQuestions.length} question(s) not preserved`);
  if (learningObjectivesPreserved === false) reasons.push("learning objectives slide changed");

  const uncertainties: string[] = [];
  if (markerSlides.size) uncertainties.push(`ordered-list numbering differs on slide(s) ${[...markerSlides].sort((a, b) => a - b).join(", ")} (text is identical; numbering may be missing or added as formatting)`);
  if (actual.unsupportedNumbering.length) uncertainties.push(`unsupported auto-number scheme(s): ${actual.unsupportedNumbering.join(", ")}`);
  const opaque = actual.slides.flatMap((s, i) => (s.opaqueContent ? [i + 1] : []));
  if (opaque.length) uncertainties.push(`slide(s) ${opaque.join(", ")} contain charts/diagrams/embedded objects whose text cannot be verified`);

  const verdict: Verdict = reasons.length ? "failed" : uncertainties.length ? "uncertain" : "passed";
  return {
    verdict,
    passed: verdict === "passed",
    expectedSlides: snapshot.length,
    actualSlides: actual.slides.length,
    matched,
    missing,
    modified,
    unexpected,
    movedBetweenSlides: moved,
    reorderedOnSlide: reordered,
    numbers,
    operators,
    questions: { total: questionLines.length, preserved: questionLines.length - missingQuestions.length, missing: missingQuestions },
    learningObjectivesPreserved,
    pictures: actual.slides.reduce((n, s) => n + s.pictures, 0),
    mediaFiles: actual.mediaFiles,
    reasons,
    uncertainties,
  };
}

export type LayoutFinding = { slide: number; pictures: number; textChars: number };
export type LayoutReport = {
  /** Slides planned as text-only that came back with a picture (cover excluded). */
  picturesOnTextOnlySlides: LayoutFinding[];
  /** Slides with more than one picture. */
  crowdedSlides: LayoutFinding[];
  totalPictures: number;
};

/**
 * Image dominance, checked SEPARATELY from content: a beautiful deck with missing text still fails compareToSnapshot,
 * and a faithful deck with too many pictures is reported here without being blocked. Theme decorations exported as
 * pictures can count too, so these are review notes, not a verdict.
 */
export function checkLayout(plans: { slideIndex: number; image: string }[], actual: ExtractedDeck): LayoutReport {
  const findings = actual.slides.map((s, i) => ({ slide: i + 1, pictures: s.pictures, textChars: s.paragraphs.reduce((n, p) => n + p.text.length, 0), planned: plans[i]?.image ?? "none" }));
  const strip = ({ slide, pictures, textChars }: LayoutFinding) => ({ slide, pictures, textChars });
  return {
    picturesOnTextOnlySlides: findings.filter((f) => f.slide > 1 && f.planned === "none" && f.pictures > 0).map(strip),
    crowdedSlides: findings.filter((f) => f.pictures > 1).map(strip),
    totalPictures: findings.reduce((n, f) => n + f.pictures, 0),
  };
}
