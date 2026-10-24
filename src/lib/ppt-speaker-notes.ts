import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";
import type { MainPhaseActivityInstruction } from "@/lib/ppt-main-phase-activity";

/**
 * Speaker notes for ONE physical slide, used by both the legacy renderer and the Gamma post-export step, so a given
 * slide carries the same notes whichever renderer drew it. Format (a line is skipped when it doesn't apply):
 *   Timing / Setup/Grouping / Say/Ask / Watch for / Answers / Marking
 * Every line comes from THIS slide: its own generated notes, its own questions and text. There is no generic filler,
 * and a line already used on an earlier slide of the deck is never repeated (`seen`). Continuation slides get their
 * own share of the time, their own say-line, a check on their own content and the answers to their own questions.
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
  /**
   * Note lines already used on earlier slides of this deck (normalised). A line found here is never repeated: notes
   * must be specific to their own slide. The builder adds this slide's lines to it.
   */
  seen?: Set<string>;
};

/** Default minutes per logical element when the notes give none; sums to a 60-minute lesson. */
const DEFAULT_MINUTES = [1, 5, 2, 2, 2, 20, 10, 5, 6, 2, 3, 1, 1];

/** One per lesson element, all different, so a default can never repeat on another slide. */
const DEFAULT_GROUPING = [
  "Whole class; have the slides and any starter materials ready.",
  "Pairs, then a quick whole-class share.",
  "Whole class; read the chapter, topic and goal together.",
  "Whole class; leave the objectives visible.",
  "Whole class; students note the outcome they find hardest.",
  "Groups as set out on the activity slide; prepare materials in advance.",
  "Students start on the Must task and move to Should and Could when ready; sit students who need support near you.",
  "Pairs; each pair agrees on one real-life example.",
  "Individual thinking, then pairs.",
  "Individual, at home.",
  "Individual and silent.",
  "Individual self-assessment.",
  "Whole class; finish on one student's question for next lesson.",
];

const NOTE_LINE = /\S/;
const TIMING_RE = /(\d+)\s*(?:[–-]\s*(\d+))?\s*(?:mins?|minutes?)\b/i;
const GROUPING_RE = /\b(groups?|pairs?|partners?|individual(?:ly)?|whole[- ]class|materials?|prepare|set up|resources?|handouts?|teams?|volunteers?)\b/i;
const SAY_RE = /\b(say|ask|explain|introduce|model|remind|invite|prompt them)\b/i;
const WATCH_RE = /\b(misconception|stuck|confus\w*|common (?:error|mistake)s?|watch for|struggl\w*)\b/i;

/** Labels a generated note may already carry; stripped before re-labelling so "Grouping: Timing: ..." can't happen. */
const LABEL_RE = /^(?:suggested\s+)?(?:timing|time|duration|setup\s*\/\s*grouping|setup|grouping|say\s*\/\s*ask|say|ask|watch\s*for|answers?|marking|marks|afl|delivery\s*tip|note|moved from slide)\s*:\s*/i;
const LABELLED = {
  timing: /^(?:suggested\s+)?(?:timing|time|duration)\s*:/i,
  grouping: /^(?:setup\s*\/\s*grouping|setup|grouping)\s*:/i,
  say: /^(?:say\s*\/\s*ask|say|ask)\s*:/i,
  watch: /^watch\s*for\s*:/i,
  answers: /^answers?\s*:/i,
  marking: /^(?:marking|marks)\s*:/i,
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const comparable = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();

function stripLabels(line: string): string {
  let s = line.trim();
  for (let i = 0; i < 4 && LABEL_RE.test(s); i++) s = s.replace(LABEL_RE, "").trim();
  return s;
}

/** The value of a labelled note line ("Watch for: ..."), if the notes carry one. */
function labelled(lines: readonly string[], re: RegExp): string | undefined {
  const hit = lines.find((l) => re.test(l));
  return hit ? stripLabels(hit) || undefined : undefined;
}

/**
 * Teacher notes as separate sentences: generated notes often pack timing, grouping, a question and a misconception
 * into one line, and each belongs in its own field. Labelled lines ("Watch for: ...") and "Prompt: ..." stay whole.
 */
function noteLines(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .flatMap((l) => (Object.values(LABELLED).some((re) => re.test(l.trim())) ? [l] : l.split(/(?<=[.!?])\s+(?=(?!Prompt\b)[A-Z"“])/)))
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
function answersFromMetadata(input: PhysicalNotesInput): string | undefined {
  const onSlide = comparable(input.lines.join(" "));
  const questions = (input.model.educationalMetadata?.questions ?? []).filter((q) => onSlide.includes(comparable(q.questionText)));
  if (!questions.length) return undefined;
  return questions.map((q) => `${q.questionId} → ${clip(q.expectedAnswer, 140)} (taught: ${q.sourceElementIds.join(", ")})`).join("; ");
}

/** The most useful line of this physical slide: its question, else a real instruction, else any line. */
function keyLine(input: PhysicalNotesInput): string {
  return input.lines.find((l) => l.trim().endsWith("?"))
    ?? input.lines.find((l) => l.trim().length >= 25 && !/^[^.?!]{0,40}:\s*[^.?!]{0,40}$/.test(l.trim()))
    ?? input.lines.find((l) => l.trim())
    ?? input.model.slideTitle;
}

export function buildPhysicalSlideNotes(input: PhysicalNotesInput): string {
  const seen = input.seen ?? new Set<string>();
  const fresh = (text: string | undefined) => !!text && !seen.has(comparable(stripLabels(text)));
  const source = input.physicalKind === "activity-instructions" || input.activity
    ? `${input.activity?.teacherNotes ?? ""}\n${input.model.speakerNotes ?? ""}`
    : input.model.speakerNotes ?? "";
  // Lines moved off the student slide (a compliance claim, marks) are kept apart so they are never squeezed out.
  const movedAt = source.search(/teacher-facing details moved from slide body:/i);
  const moved = movedAt >= 0 ? noteLines(source.slice(movedAt)).filter((l) => !LABELLED.marking.test(l)) : [];
  const lines = noteLines(source).filter((l) => !PURE_TIMING_RE.test(l) && !moved.includes(l));
  const used = new Set<string>();
  // A misconception sentence that mentions "groups" is still a watch-for line, never a grouping or say line.
  const pick = (re: RegExp) => {
    const found = lines.find((l) => re.test(l) && !Object.values(LABELLED).some((lr) => lr.test(l)) && !used.has(l) && (re === WATCH_RE || !WATCH_RE.test(l)) && fresh(l));
    if (found) used.add(found);
    return found ? stripLabels(found) : undefined;
  };
  const fromLabel = (re: RegExp) => {
    const value = labelled(lines, re);
    return fresh(value) ? value : undefined;
  };

  const out: string[] = [];
  const quote = (s: string) => `"${clip(s.replace(/"/g, "'"), 120)}"`;
  const key = keyLine(input);

  out.push(`Timing: about ${minutesFor(input)} min${input.parts > 1 ? ` (part ${input.part} of ${input.parts})` : ""}.`);

  if (input.part > 1) {
    // A continuation: its own say-line and a check on its own content, never a copy of part 1's notes.
    out.push(`Say/Ask: "Let's continue — ${clip(key.replace(/"/g, "'"), 110)}"`);
    const answers = answersFromMetadata(input);
    out.push(answers ? `Answers: ${answers}` : `Watch for: students who can't explain ${quote(key)} in their own words. Prompt: "What does this part tell us?"`);
  } else if (input.deckIdx === 0) {
    // Title slide: timing and an opening line only.
    out.push(`Say/Ask: "Today we're learning about ${clip(input.topic?.trim() || input.model.slideTitle, 80)}. What do you already know about it?"`);
  } else {
    const grouping = input.physicalKind === "activity-instructions" && input.activity?.groupSize
      ? `groups of ${input.activity.groupSize}${input.activity.requiredMaterials.length ? `; materials: ${input.activity.requiredMaterials.join(", ")}` : ""}.`
      : fromLabel(LABELLED.grouping) ?? pick(GROUPING_RE) ?? DEFAULT_GROUPING[input.deckIdx];
    if (grouping && fresh(grouping)) out.push(`Setup/Grouping: ${clip(grouping, 210)}`);

    const say = input.physicalKind === "activity-instructions"
      ? `"Read the steps with me before you start: ${clip((input.activity?.activityGoal || key).replace(/"/g, "'"), 110)}"`
      : fromLabel(LABELLED.say) ?? pick(SAY_RE) ?? quote(key);
    out.push(`Say/Ask: ${clip(say, 210)}`);

    const watch = fromLabel(LABELLED.watch) ?? pick(WATCH_RE);
    if (watch) out.push(`Watch for: ${clip(watch, 210)}`);

    const answers = answersFromMetadata(input) ?? fromLabel(LABELLED.answers);
    if (answers) out.push(`Answers: ${clip(answers, 480)}`);

    const marking = [labelled(lines, LABELLED.marking), ...noteLines(source).filter((l) => LABELLED.marking.test(l)).map(stripLabels)]
      .filter((v, i, a): v is string => !!v && a.indexOf(v) === i)
      .join("; ");
    if (marking && fresh(marking) && out.length < 6) out.push(`Marking: ${clip(marking, 220)}`);

    // Room for one more teacher-only point: first anything moved off the student slide, else an unused note.
    if (out.length < 6) {
      if (moved.length && fresh(moved.join(" "))) out.push(`Note: ${clip(moved.map(stripLabels).join(" "), 220)}`);
      else if (out.length < 3) {
        const extra = lines.find((l) => !used.has(l) && !Object.values(LABELLED).some((re) => re.test(l)) && fresh(l));
        if (extra) out.push(`Note: ${clip(stripLabels(extra), 200)}`);
      }
    }
  }

  // Every slide except the title gets at least three lines; the top-up is built from this slide's own key line, so it
  // can never repeat another slide's notes.
  if (input.deckIdx !== 0 && out.length < 3) {
    out.push(`Watch for: students who can't explain ${quote(key)} in their own words. Prompt: "Can you say that another way?"`);
  }

  const result = out.slice(0, 6);
  for (const line of result.slice(1)) seen.add(comparable(stripLabels(line)));
  return result.join("\n");
}

/** Lines (other than Timing) that appear on more than one slide's notes: must be empty for a finished deck. */
export function duplicateNoteLines(notes: readonly string[]): { line: string; slides: number[] }[] {
  const where = new Map<string, number[]>();
  notes.forEach((n, i) => {
    for (const line of n.split("\n").slice(1)) {
      const key = comparable(stripLabels(line));
      if (!key) continue;
      where.set(key, [...(where.get(key) ?? []), i + 1]);
    }
  });
  return [...where.entries()].filter(([, s]) => new Set(s).size > 1).map(([line, slides]) => ({ line, slides }));
}
