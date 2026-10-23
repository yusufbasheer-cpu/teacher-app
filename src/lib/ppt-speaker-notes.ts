import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import type { MainPhaseActivityInstruction } from "@/lib/ppt-main-phase-activity";

/**
 * Speaker notes for ONE physical slide, used by both the legacy renderer and the Gamma post-export step, so a given
 * slide carries the same notes whichever renderer drew it. 3–6 short lines: timing, grouping/preparation, what to
 * say or ask, a likely stuck point with a prompt, and expected answers for the questions printed on THIS slide.
 * Continuation slides get their own share of the time and their own say-line and answers, not a copy of part 1.
 */
export type PhysicalNotesInput = {
  /** The logical slide, after teacher-facing lines were moved into its notes. */
  model: StructuredLessonSlideModel;
  deckIdx: number;
  /** Student-facing lines shown on this physical slide. */
  lines: string[];
  part: number;
  parts: number;
  /** Characters of the whole section (all parts), for splitting its time across parts. */
  sectionChars: number;
  physicalKind?: "content" | "activity-instructions";
  activity?: MainPhaseActivityInstruction;
  topic?: string;
};

/** Default minutes per logical element when the notes give none; sums to a 60-minute lesson. */
const DEFAULT_MINUTES = [1, 5, 2, 2, 2, 20, 10, 5, 6, 2, 3, 1, 1];

const DEFAULT_GROUPING = [
  "Whole class; have the slides and any starter materials ready.",
  "Pairs, then a quick whole-class share.",
  "Whole class.",
  "Whole class; leave the objectives visible.",
  "Whole class.",
  "Groups as set out on the activity slide; prepare materials in advance.",
  "Students start on the Must task and move to Should and Could when ready; sit students who need support near you.",
  "Pairs.",
  "Individual thinking, then pairs.",
  "Individual, at home.",
  "Individual and silent.",
  "Individual self-assessment.",
  "Whole class.",
];

const DEFAULT_WATCH_FOR = "Watch for: answers that repeat a definition without using today's example. Prompt: \"Can you show me where that happens in today's example?\"";

const NOTE_LINE = /\S/;
const TIMING_RE = /(\d+)\s*(?:[–-]\s*(\d+))?\s*(?:mins?|minutes?)\b/i;
const GROUPING_RE = /\b(groups?|pairs?|partners?|individual(?:ly)?|whole[- ]class|materials?|prepare|set up|resources?|handouts?|teams?|volunteers?)\b/i;
const SAY_RE = /\b(say|ask|explain|introduce|model|remind|invite|prompt them)\b/i;
const WATCH_RE = /\b(misconception|stuck|confus\w*|common (?:error|mistake)s?|watch for|struggl\w*)\b/i;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const comparable = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();

/**
 * Teacher notes as separate sentences: generated notes often pack timing, grouping, a question and a misconception
 * into one line, and each belongs in its own field. "Prompt: ..." stays attached to the sentence it completes.
 */
function noteLines(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=(?!Prompt\b)[A-Z"“])/))
    .map((l) => l.trim())
    .filter((l) => NOTE_LINE.test(l) && !/^teacher-facing details moved/i.test(l));
}

/** A sentence that only states a duration ("Timing: 6 minutes.") adds nothing beyond the Timing line. */
const PURE_TIMING_RE = /^(?:suggested\s+)?(?:timing|time|duration)\s*:?\s*(?:about\s+)?\d+\s*(?:[–-]\s*\d+)?\s*(?:mins?|minutes?)\.?$/i;

function minutesFor(input: PhysicalNotesInput): number {
  if (input.physicalKind === "activity-instructions") return Math.max(1, Math.round((input.activity?.durationMinutes ?? 10) * 0.2));
  const fromActivity = input.activity?.durationMinutes;
  const m = (input.model.speakerNotes ?? "").match(TIMING_RE);
  const section = fromActivity ?? (m ? Math.round((Number(m[1]) + Number(m[2] ?? m[1])) / 2) : DEFAULT_MINUTES[input.deckIdx] ?? 2);
  if (input.parts <= 1 || input.sectionChars <= 0) return Math.max(1, section);
  const share = input.lines.join("").length / input.sectionChars;
  return Math.max(1, Math.round(section * share));
}

/** Expected answers for the questions that are printed on this physical slide (and only those). */
function answersLine(input: PhysicalNotesInput): string | undefined {
  const onSlide = comparable(input.lines.join(" "));
  const questions = (input.model.educationalMetadata?.questions ?? []).filter((q) => onSlide.includes(comparable(q.questionText)));
  if (questions.length) {
    return `Answers: ${questions.map((q) => `${q.questionId} → ${clip(q.expectedAnswer, 140)} (taught: ${q.sourceElementIds.join(", ")})`).join("; ")}`;
  }
  if (input.lines.some((l) => l.trim().endsWith("?"))) {
    return "Answers: accept responses that use today's key terms and example; check them against the main-phase teaching.";
  }
  return undefined;
}

export function buildPhysicalSlideNotes(input: PhysicalNotesInput): string {
  const source = input.physicalKind === "activity-instructions" || input.activity
    ? `${input.activity?.teacherNotes ?? ""}\n${input.model.speakerNotes ?? ""}`
    : input.model.speakerNotes ?? "";
  // Lines moved off the student slide (e.g. a compliance claim) are kept apart so they are never squeezed out.
  const movedAt = source.search(/teacher-facing details moved from slide body:/i);
  const moved = movedAt >= 0 ? noteLines(source.slice(movedAt)) : [];
  const lines = noteLines(movedAt >= 0 ? source.slice(0, movedAt) : source).filter((l) => !PURE_TIMING_RE.test(l));
  const used = new Set<string>();
  // A misconception sentence that mentions "groups" is still a watch-for line, never a grouping or say line.
  const pick = (re: RegExp) => {
    const found = lines.find((l) => re.test(l) && !/^answers?\b/i.test(l) && !used.has(l) && (re === WATCH_RE || !WATCH_RE.test(l)));
    if (found) used.add(found);
    return found;
  };

  const minutes = minutesFor(input);
  const out: string[] = [
    `Timing: about ${minutes} min${input.parts > 1 ? ` (part ${input.part} of ${input.parts})` : ""}.`,
  ];

  const grouping = input.physicalKind === "activity-instructions" && input.activity?.groupSize
    ? `Grouping: groups of ${input.activity.groupSize}${input.activity.requiredMaterials.length ? `; materials: ${input.activity.requiredMaterials.join(", ")}` : ""}.`
    : pick(GROUPING_RE);
  out.push(grouping ? (/^grouping/i.test(grouping) ? clip(grouping, 220) : `Grouping: ${clip(grouping, 210)}`) : `Grouping: ${DEFAULT_GROUPING[input.deckIdx] ?? "Whole class."}`);

  // Prefer the slide's own question, then a real instruction, over a short heading such as "Exit Card".
  const first = input.lines.find((l) => l.trim().endsWith("?"))
    ?? input.lines.find((l) => l.trim().length >= 25 && !/^[^.?!]{0,40}:\s*[^.?!]{0,40}$/.test(l.trim()))
    ?? input.lines.find((l) => l.trim())
    ?? input.model.slideTitle;
  if (input.part > 1) {
    out.push(`Say: "Let's continue — ${clip(first.replace(/"/g, "'"), 110)}"`);
  } else if (input.physicalKind === "activity-instructions") {
    out.push(`Say: "Read the steps with me before you start: ${clip((input.activity?.activityGoal || first).replace(/"/g, "'"), 110)}"`);
  } else {
    const say = pick(SAY_RE);
    out.push(say ? (/^say|^ask/i.test(say) ? clip(say, 220) : `Say/ask: ${clip(say, 210)}`) : `Say: "${clip(first.replace(/"/g, "'"), 120)}"`);
  }

  const watch = pick(WATCH_RE);
  out.push(watch ? (/^watch for/i.test(watch) ? clip(watch, 220) : `Watch for: ${clip(watch, 210)}`) : DEFAULT_WATCH_FOR);

  const answers = answersLine(input);
  if (answers) out.push(answers);

  // Room for one more teacher-only point, up to six lines: first anything moved off the student slide, else an
  // unused note line.
  if (input.part === 1 && out.length < 6) {
    if (moved.length) out.push(`Moved from slide: ${clip(moved.join(" "), 220)}`);
    else {
      const extra = lines.find((l) => !used.has(l));
      if (extra) out.push(`Note: ${clip(extra, 200)}`);
    }
  }

  return out.slice(0, 6).join("\n");
}
