import JSZip from "jszip";
import type { SlideSnapshot } from "./payload";

export type ExtractedSlide = { paragraphs: string[]; pictures: number };
export type ExtractedDeck = { slides: ExtractedSlide[]; mediaFiles: number };

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
  const slides: ExtractedSlide[] = [];
  for (const rid of order) {
    const target = targetById.get(rid);
    const path = target ? `ppt/${target.replace(/^\/?(ppt\/)?/, "")}` : "";
    const xml = path ? await zip.file(path)?.async("string") : undefined;
    if (!xml) throw new Error(`Slide part missing for ${rid}`);
    const paragraphs = [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)]
      .map((p) => {
        const runs = [...p[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/>/g)];
        return runs.map((r) => (r[1] === undefined ? " " : decode(r[1]))).join("");
      })
      .filter((t) => t.trim());
    slides.push({ paragraphs, pictures: (xml.match(/<p:pic\b/g) ?? []).length });
  }
  const mediaFiles = Object.keys(zip.files).filter((n) => n.startsWith("ppt/media/") && !zip.files[n].dir).length;
  return { slides, mediaFiles };
}

/**
 * Presentation-equivalent normalisation ONLY: whitespace, NBSP, markdown emphasis wrappers and
 * unordered list markers (which become real bullets in PPTX). Punctuation, digits, operators and
 * ordered-list numbers are preserved.
 */
export function normalise(s: string): string {
  return s
    .replace(/[ ​‎‏]/g, " ")
    .replace(/^\s*(?:[-*•▪◦‣●]\s+|#{1,6}\s+)/, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

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

export type ModifiedText = { slide: number; expected: string; found: string };

export type ValidationReport = {
  passed: boolean;
  expectedSlides: number;
  actualSlides: number;
  matched: number;
  missing: { slide: number; text: string }[];
  modified: ModifiedText[];
  unexpected: { slide: number; text: string }[];
  /** Source line found, but on a different slide than expected. */
  movedBetweenSlides: { text: string; expectedSlide: number; foundSlide: number }[];
  numbers: { missing: string[]; unexpected: string[] };
  operators: { missing: string[]; unexpected: string[] };
  questions: { total: number; preserved: number; missing: string[] };
  learningObjectivesPreserved: boolean | null;
  pictures: number;
  mediaFiles: number;
  reasons: string[];
};

/** Index of the Learning Objectives slide in the 13-slide deck. */
const LEARNING_OBJECTIVES_INDEX = 3;

export function compareToSnapshot(snapshot: SlideSnapshot[], actual: ExtractedDeck): ValidationReport {
  const expectedLines = snapshot.map((s) => s.lines.map(normalise).filter(Boolean));
  const actualParas = actual.slides.map((s) => s.paragraphs.map(normalise).filter((p) => p && !/^\d{1,3}$/.test(p)));
  const actualJoined = actualParas.map((p) => p.join(" "));
  const expectedJoined = expectedLines.map((l) => l.join(" "));

  const missing: ValidationReport["missing"] = [];
  const modified: ModifiedText[] = [];
  const unexpected: ValidationReport["unexpected"] = [];
  const moved: ValidationReport["movedBetweenSlides"] = [];
  let matched = 0;

  const slides = Math.min(snapshot.length, actual.slides.length);
  for (let i = 0; i < slides; i++) {
    const unexpectedHere = actualParas[i].filter((p) => !expectedJoined[i].includes(p));
    const claimed = new Set<number>();
    for (const line of expectedLines[i]) {
      if (actualJoined[i].includes(line)) {
        matched++;
        continue;
      }
      const elsewhere = actualJoined.findIndex((j, k) => k !== i && j.includes(line));
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
    unexpectedHere.forEach((p, idx) => {
      if (!claimed.has(idx)) unexpected.push({ slide: i + 1, text: p });
    });
  }
  // Slides beyond the expected count are entirely unexpected; missing slides are entirely missing.
  for (let i = slides; i < actual.slides.length; i++) actualParas[i].forEach((t) => unexpected.push({ slide: i + 1, text: t }));
  for (let i = slides; i < snapshot.length; i++) expectedLines[i].forEach((t) => missing.push({ slide: i + 1, text: t }));

  const srcAll = expectedJoined.join(" ");
  const outAll = actualJoined.join(" ");
  const numbers = diffTally(tally(srcAll, NUMBER_RE), tally(outAll, NUMBER_RE));
  const operators = diffTally(tally(srcAll, OPERATOR_RE), tally(outAll, OPERATOR_RE));

  const questionLines = expectedLines.flat().filter((l) => /[?؟]\s*$/.test(l));
  const missingQuestions = questionLines.filter((q) => !outAll.includes(q));
  const lo = expectedLines[LEARNING_OBJECTIVES_INDEX];
  const learningObjectivesPreserved =
    lo && actualJoined[LEARNING_OBJECTIVES_INDEX] !== undefined
      ? lo.every((l) => actualJoined[LEARNING_OBJECTIVES_INDEX].includes(l))
      : null;

  const reasons: string[] = [];
  if (snapshot.length !== actual.slides.length) reasons.push(`slide count ${actual.slides.length} ≠ expected ${snapshot.length}`);
  if (missing.length) reasons.push(`${missing.length} missing text line(s)`);
  if (modified.length) reasons.push(`${modified.length} modified text line(s)`);
  if (unexpected.length) reasons.push(`${unexpected.length} unexpected text line(s)`);
  if (moved.length) reasons.push(`${moved.length} line(s) on a different slide`);
  if (numbers.missing.length || numbers.unexpected.length) reasons.push("numeric values differ");
  if (operators.missing.length || operators.unexpected.length) reasons.push("operators/symbols differ");
  if (missingQuestions.length) reasons.push(`${missingQuestions.length} question(s) not preserved`);
  if (learningObjectivesPreserved === false) reasons.push("learning objectives slide changed");

  return {
    passed: reasons.length === 0,
    expectedSlides: snapshot.length,
    actualSlides: actual.slides.length,
    matched,
    missing,
    modified,
    unexpected,
    movedBetweenSlides: moved,
    numbers,
    operators,
    questions: { total: questionLines.length, preserved: questionLines.length - missingQuestions.length, missing: missingQuestions },
    learningObjectivesPreserved,
    pictures: actual.slides.reduce((n, s) => n + s.pictures, 0),
    mediaFiles: actual.mediaFiles,
    reasons,
  };
}
