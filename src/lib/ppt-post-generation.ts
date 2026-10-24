import {
  regenerateSlideNotes,
  rewriteSdgSentence,
  shortenSlideToLimit,
  type SlideGenResult,
} from "@/lib/ppt-individual-slide-generator";
import {
  NEVER_REWRITE_DECK_INDICES,
  SLIDE_WORD_LIMITS,
  deckSdg,
  harmoniseSdgLine,
  officialSdgLabel,
  sdgNumbersIn,
  studentWordCount,
  type DeckSdg,
} from "@/lib/ppt-slide-guards";
import type { PresentationLanguage } from "@/lib/ppt-language";

/**
 * Runs once the 13 lesson elements are written, before the lesson is saved or sent to Gamma:
 *   1. one SDG for the whole deck, always with its official name (the chapter can never fill the SDG slot);
 *   2. hard word limits: an over-limit element goes back to DeepSeek to be shortened, keeping its meaning;
 *   3. no repeated notes: a slide whose Say/Ask, Watch for or Answers line repeats another slide's gets new notes.
 * Each step is reported (for logs and the evidence harness) and never drops a slide.
 */
export type PostGenerationReport = {
  sdg?: DeckSdg;
  sdgRewrites: number;
  words: { slide: number; title: string; before: number; after: number; limit?: number; shortened: boolean; note?: string }[];
  repeatedNotes: { slide: number; repeated: string[]; regenerated: boolean }[];
};

const comparable = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const NOTE_KEY_RE = /^(say\s*\/\s*ask|say|ask|watch\s*for|answers?)\s*:\s*/i;

/** The notes lines that must be unique across slides (Say/Ask, Watch for, Answers), normalised. */
export function uniqueNoteKeys(notes: string): string[] {
  return notes.split(/\r?\n/).map((l) => l.trim()).filter((l) => NOTE_KEY_RE.test(l)).map((l) => comparable(l.replace(NOTE_KEY_RE, ""))).filter(Boolean);
}

const STOP = new Set(["students", "student", "they", "their", "them", "that", "this", "with", "from", "rather", "than", "prompt", "where", "what", "which", "does", "will", "have", "about", "into", "make", "making", "think", "saying", "might", "instead", "when"]);
const contentWords = (s: string) => new Set(comparable(s).split(" ").filter((w) => w.length > 3 && !STOP.has(w)));

/** A "Watch for" line is a repeat when it names the same difficulty in other words (most key words shared). */
export function sameWatchFor(a: string, b: string): boolean {
  const x = contentWords(a.split(/prompt/i)[0] ?? a);
  const y = contentWords(b.split(/prompt/i)[0] ?? b);
  if (!x.size || !y.size) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size) >= 0.6;
}

const watchLines = (notes: string) => notes.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^watch\s*for\s*:/i.test(l)).map((l) => l.replace(/^watch\s*for\s*:\s*/i, ""));

export async function finishGeneratedDeck(
  bodies: SlideGenResult[],
  ctx: { titles: readonly string[]; language: PresentationLanguage; usageUserId?: string; topic?: string; uae?: boolean },
): Promise<PostGenerationReport> {
  // 1. One SDG, official name. A line that cited a DIFFERENT goal also gets a new sentence about the right goal: its
  //    old sentence described the other goal (e.g. clean energy) and would be wrong under the corrected label.
  const sdg = deckSdg(bodies);
  let sdgRewrites = 0;
  /** Slides whose SDG sentence was replaced: their notes were written for the old sentence and get refreshed. */
  const refreshNotes = new Set<number>();
  if (sdg) {
    const label = officialSdgLabel(sdg);
    for (const [index, b] of bodies.entries()) {
      const lines = await Promise.all(b.body.split("\n").map(async (line) => {
        const fixed = harmoniseSdgLine(line, sdg);
        if (fixed === line) return line;
        sdgRewrites++;
        if (!sdgNumbersIn(line).some((n) => n !== sdg.id)) return fixed;
        refreshNotes.add(index);
        const at = fixed.indexOf(label);
        const head = fixed.slice(0, at + label.length);
        const sentence = ctx.topic
          ? await rewriteSdgSentence({ topic: ctx.topic, sdgLabel: label, uae: !!ctx.uae, usageUserId: ctx.usageUserId })
          : undefined;
        return sentence ? `${head}. ${sentence}` : head;
      }));
      b.body = lines.join("\n");
    }
  }

  // 2. Word limits, shortened in parallel by DeepSeek where needed.
  const words = await Promise.all(bodies.map(async (b, index) => {
    const limit = SLIDE_WORD_LIMITS[index];
    const before = studentWordCount(b.body);
    const row = { slide: index + 1, title: ctx.titles[index] ?? `Slide ${index + 1}`, before, after: before, limit, shortened: false } as PostGenerationReport["words"][number];
    if (!limit || before <= limit) return row;
    if (NEVER_REWRITE_DECK_INDICES.has(index)) return { ...row, note: "teacher's own words — reported, not rewritten" };
    const result = await shortenSlideToLimit({
      slideName: row.title,
      body: b.body,
      limit,
      questions: (b.questionSources ?? []).map((q) => q.questionText),
      usageUserId: ctx.usageUserId,
      language: ctx.language,
    });
    if (result.ok) b.body = result.body;
    return { ...row, after: result.ok ? result.words : before, shortened: result.ok, ...(result.ok ? {} : { note: `not shortened (${result.reason ?? "no usable response"}); kept as written` }) };
  }));

  // 3. Notes never repeat across slides: the same Say/Ask, Watch for or Answers line, or the same "Watch for"
  //    difficulty in other words, is regenerated for the later slide.
  const repeatedNotes: PostGenerationReport["repeatedNotes"] = [];
  const seen = new Set<string>();
  const seenWatch: string[] = [];
  const repeatsIn = (notes: string) => [
    ...uniqueNoteKeys(notes).filter((k) => seen.has(k)),
    ...watchLines(notes).filter((w) => !seen.has(comparable(w)) && seenWatch.some((s) => sameWatchFor(s, w))).map(comparable),
  ];
  for (let index = 0; index < bodies.length; index++) {
    const b = bodies[index]!;
    const repeated = repeatsIn(b.teacherNotes);
    if (repeated.length || refreshNotes.has(index)) {
      const avoid = bodies.flatMap((other, i) => (i === index ? [] : other.teacherNotes.split(/\r?\n/).filter((l) => NOTE_KEY_RE.test(l.trim()))));
      const fresh = await regenerateSlideNotes({ slideName: ctx.titles[index] ?? `Slide ${index + 1}`, body: b.body, currentNotes: b.teacherNotes, avoidLines: avoid, usageUserId: ctx.usageUserId });
      const stillRepeated = fresh ? repeatsIn(fresh) : repeated;
      if (fresh && stillRepeated.length === 0) b.teacherNotes = fresh;
      else if (repeated.length) {
        // Last resort: drop the repeated lines rather than ship them twice.
        b.teacherNotes = b.teacherNotes.split(/\r?\n/).filter((l) => {
          const t = l.trim();
          if (!NOTE_KEY_RE.test(t)) return true;
          const value = t.replace(NOTE_KEY_RE, "");
          return !seen.has(comparable(value)) && !(/^watch\s*for/i.test(t) && seenWatch.some((s) => sameWatchFor(s, value)));
        }).join("\n");
      }
      repeatedNotes.push({ slide: index + 1, repeated, regenerated: !!fresh && stillRepeated.length === 0 });
    }
    for (const k of uniqueNoteKeys(b.teacherNotes)) seen.add(k);
    seenWatch.push(...watchLines(b.teacherNotes));
  }

  return { sdg, sdgRewrites, words, repeatedNotes };
}
