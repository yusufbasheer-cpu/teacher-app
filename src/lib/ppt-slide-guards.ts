import { isComplianceClaim } from "@/lib/ppt-educational-quality";
import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

/**
 * Student-slide guards shared by generation (DeepSeek output) and both renderers (Gamma and the built-in deck).
 * Slides hold only student-facing text written to "you"; marking guides, marks, rubrics, compliance and anything
 * about the teacher go to the speaker notes. These run on every deck, so older saved lessons are cleaned too.
 */

// ── Teacher-facing text ──────────────────────────────────────────────────────

/** Whole lines that belong in the notes, never on the slide. */
const TEACHER_LINE_RES: RegExp[] = [
  /\bteachers?\b/i,
  /\bmarking\b/i, // marking guide / scheme / criteria
  /\brubrics?\b/i,
  /\b(?:KHDA|SPEA)\b/,
  /\binspect(?:ion|ions|or|ors)\b/i,
  /^\s*(?:total|max(?:imum)?)\s*(?:score|marks?)?\s*[:=\-–]?\s*\d+\s*marks?\b/i,
  /^\s*\(?\s*\d+\s*marks?\s*\)?\s*$/i,
];

/** "(4 marks)", "[2 marks]", "— 3 marks" at the end of an otherwise student-facing line. */
const INLINE_MARKS_RE = /\s*(?:[([]\s*\d+\s*marks?\s*[)\]]|[-–—:]\s*\d+\s*marks?)\s*$/i;

/** The words the pre-Gamma scan checks for (and logs). "marks" only as a score ("4 marks"), not "question marks". */
const SCAN_RES: { word: string; re: RegExp }[] = [
  { word: "teacher", re: /\bteachers?\b/i },
  { word: "marking", re: /\bmarking\b/i },
  { word: "marks", re: /\b\d+\s*marks?\b/i },
  { word: "KHDA", re: /\bKHDA\b/ },
  { word: "SPEA", re: /\bSPEA\b/ },
  { word: "inspection", re: /\binspect(?:ion|ions|or|ors)\b/i },
  { word: "rubric", re: /\brubrics?\b/i },
];

export function teacherKeywordsIn(text: string): string[] {
  return SCAN_RES.filter(({ re }) => re.test(text)).map(({ word }) => word);
}

/** True when the whole line is teacher-facing (marking, marks totals, rubric, compliance, about the teacher). */
export function isTeacherOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return isComplianceClaim(t) || TEACHER_LINE_RES.some((re) => re.test(t));
}

/** Removes an inline "(4 marks)" from a student line; returns the clean line and the marks note (if any). */
export function stripInlineMarks(line: string): { line: string; marks?: string } {
  const m = line.match(INLINE_MARKS_RE);
  if (!m) return { line };
  const clean = line.slice(0, m.index).trimEnd();
  const marks = m[0].replace(/[^\d]/g, "");
  return { line: clean, marks: `${clean.slice(0, 60)}${clean.length > 60 ? "…" : ""} — ${marks} mark${marks === "1" ? "" : "s"}` };
}

/**
 * Splits a slide body into student lines and teacher notes: whole teacher-facing lines move, inline marks are
 * stripped and recorded as marking notes. Lines keep their original form (bullets, numbering) otherwise.
 */
export function separateTeacherText(body: string): { studentLines: string[]; moved: string[]; marking: string[] } {
  const studentLines: string[] = [];
  const moved: string[] = [];
  const marking: string[] = [];
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.trim() && isTeacherOnlyLine(raw)) {
      (/\bmarks?\b|\bmarking\b|\brubric/i.test(raw) ? marking : moved).push(raw.trim());
      continue;
    }
    const { line, marks } = stripInlineMarks(raw);
    if (marks) marking.push(marks);
    studentLines.push(line);
  }
  return { studentLines, moved, marking };
}

// ── Bullets and words ────────────────────────────────────────────────────────

/**
 * Leading bullet characters Gamma would double. Symbol bullets ("•", "·", "▪") count even without a space; "-", "*",
 * "+" and "–" only when a space follows, so "-5 °C" or "*important*" keep their first character. Numbered steps stay.
 */
export const LEADING_BULLET_RE = /^\s*(?:[•·▪●◦‣]\s*|[-*+–]\s+)+(?=\S)/;

export function stripLeadingBullet(line: string): string {
  return line.replace(LEADING_BULLET_RE, "");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Words a student would see: teacher-facing lines and inline marks excluded. */
export function studentWordCount(body: string): number {
  return countWords(separateTeacherText(body).studentLines.join(" "));
}

/**
 * Hard word limits per lesson element (0-based deck index), counted before the deck goes to Gamma. Main phase (5)
 * keeps its own overflow rules and the Extended Task (9) its one-slide rules, so neither has a limit here.
 * Objectives (3) are the teacher's own words, so they are reported but never rewritten.
 */
export const SLIDE_WORD_LIMITS: Partial<Record<number, number>> = {
  0: 60, 1: 80, 2: 60, 3: 60, 4: 60, 6: 80, 7: 70, 8: 80, 10: 60, 11: 60, 12: 60,
};
export const NEVER_REWRITE_DECK_INDICES = new Set([0, 3, 12]);
export const MAX_WORDS_PER_BULLET = 15;

// ── SDG: one goal, official names ───────────────────────────────────────────

export const OFFICIAL_SDG_NAMES: Record<number, string> = {
  1: "No Poverty", 2: "Zero Hunger", 3: "Good Health and Well-being", 4: "Quality Education", 5: "Gender Equality",
  6: "Clean Water and Sanitation", 7: "Affordable and Clean Energy", 8: "Decent Work and Economic Growth",
  9: "Industry, Innovation and Infrastructure", 10: "Reduced Inequalities", 11: "Sustainable Cities and Communities",
  12: "Responsible Consumption and Production", 13: "Climate Action", 14: "Life Below Water", 15: "Life on Land",
  16: "Peace, Justice and Strong Institutions", 17: "Partnerships for the Goals",
};

export type DeckSdg = { id: number; name: string };

export function officialSdgLabel(sdg: DeckSdg): string {
  return `SDG ${sdg.id} — ${sdg.name}`;
}

const SDG_MENTION_RE = /\b(?:SDG|Sustainable Development Goal)\s*#?\s*(\d{1,2})\b/i;
const normaliseName = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** The SDG numbers a line cites explicitly ("SDG 7", "Sustainable Development Goal 13"). */
export function sdgNumbersIn(line: string): number[] {
  return [...line.matchAll(/\b(?:SDG|Sustainable Development Goal)\s*#?\s*(\d{1,2})\b/gi)].map((m) => Number(m[1]));
}

/** Number of the SDG named in a line, by number or by official name. */
function sdgIdIn(line: string): number | undefined {
  const byNumber = line.match(SDG_MENTION_RE);
  if (byNumber) return Number(byNumber[1]);
  const lower = normaliseName(line);
  const byName = Object.entries(OFFICIAL_SDG_NAMES).find(([, name]) => lower.includes(normaliseName(name)));
  return byName && /\b(?:SDG|Sustainable Development Goal|global goal)\b/i.test(line) ? Number(byName[0]) : undefined;
}

/** The deck's one SDG: from the Chapter/Topic/SDG element (index 2) first, always with its official name. */
export function deckSdg(deck: readonly Pick<StructuredLessonSlideModel, "body">[]): DeckSdg | undefined {
  for (const index of [2, ...deck.map((_, i) => i).filter((i) => i !== 2)]) {
    for (const line of (deck[index]?.body ?? "").split("\n")) {
      const id = SDG_MENTION_RE.test(line) ? sdgIdIn(line) : undefined;
      if (id && OFFICIAL_SDG_NAMES[id]) return { id, name: OFFICIAL_SDG_NAMES[id] };
    }
  }
  return undefined;
}

/**
 * Rewrites every SDG reference to the deck's one SDG with its official name. Whatever followed "SDG n —" up to the
 * end of that clause (another goal's name, or the chapter/topic dropped into the slot) is replaced; any sentence
 * after it (". The UAE...") is kept.
 */
export function harmoniseSdgLine(line: string, sdg: DeckSdg): string {
  if (!/\b(?:SDG|Sustainable Development Goal)\b/i.test(line)) return line;
  const label = officialSdgLabel(sdg);
  return line.replace(
    /\b(?:SDG|Sustainable Development Goal)\s*#?\s*\d{1,2}\b(?:\s*[-–—:]\s*[^.;:!?\n(–—]*)?/gi,
    (match) => `${label}${match.match(/\s+$/)?.[0] ?? ""}`,
  );
}

// ── Chapter shown once ───────────────────────────────────────────────────────

/** A line that only restates the chapter (e.g. "Chapter 7 — Getting to Know Plants (NCERT Science)"). */
export function isChapterLine(line: string, chapter?: string): boolean {
  const t = line.trim().replace(/^(?:item\s*\d+\s*[-–—:]\s*)/i, "");
  if (!t) return false;
  if (/^chapter\b/i.test(t) && t.length <= 110) return true;
  if (/\(\s*NCERT[^)]*\)\s*$/i.test(t) && t.length <= 110) return true;
  const c = chapter?.trim();
  return !!c && normaliseName(t) === normaliseName(c);
}

// ── Whole-deck preparation (both renderers) ─────────────────────────────────

export type DeckGuardReport = {
  sdg?: DeckSdg;
  movedLines: { slide: number; keywords: string[] }[];
  sdgRewrites: number;
  chapterLinesRemoved: number;
};

/**
 * Applied to the 13 lesson elements before either renderer builds slides: one official SDG everywhere, the chapter
 * line only on the title slide, and no leading bullet characters. Teacher-facing text is moved per slide by
 * moveTeacherFacingLinesToNotes (it needs the notes field), which uses the same detectors as above.
 */
export function prepareDeckForStudents(deck: StructuredLessonSlideModel[], opts: { chapter?: string } = {}): { deck: StructuredLessonSlideModel[]; report: DeckGuardReport } {
  const sdg = deckSdg(deck);
  let sdgRewrites = 0;
  let chapterLinesRemoved = 0;
  let generatedChapter: string | undefined;
  const out = deck.map((model, index) => {
    if (index === 0) return model;
    const lines = model.body.replace(/\r\n/g, "\n").split("\n").filter((line) => {
      const drop = isChapterLine(line, opts.chapter);
      if (drop) {
        chapterLinesRemoved++;
        if (index === 2) generatedChapter ??= line.trim().replace(/^(?:item\s*\d+\s*[-–—:]\s*)/i, "").replace(/^chapter\s*[:\-–—]\s*/i, "");
      }
      return !drop;
    }).map((line) => {
      if (!sdg) return line;
      const next = harmoniseSdgLine(line, sdg);
      if (next !== line) sdgRewrites++;
      return next;
    });
    const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return body === model.body ? model : { ...model, body: body || model.body };
  });
  // Shown once, on the title slide: when the teacher gave no chapter, the one the lesson generated moves there.
  if (!opts.chapter?.trim() && generatedChapter && out[0] && !out[0].body.includes(generatedChapter)) {
    out[0] = { ...out[0], body: [out[0].body, generatedChapter].filter(Boolean).join("\n") };
  }
  return { deck: out, report: { sdg, movedLines: [], sdgRewrites, chapterLinesRemoved } };
}
