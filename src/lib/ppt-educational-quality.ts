import type { StructuredLessonSlideModel } from "@/lib/ppt-structured-lesson";

export type SelectedSdg = {
  id: number;
  name: string;
  description: string;
};

export type QuestionSource = {
  questionId: string;
  questionText: string;
  expectedAnswer: string;
  sourceElementIds: string[];
  learningObjectiveRef?: string;
};

export type SlideEducationalMetadata = {
  elementId: string;
  selectedSdg?: SelectedSdg;
  questions?: QuestionSource[];
};

/** Deck-level quality metadata carried with the saved lesson in a private outline trailer (never displayed). */
export type DeckQualityMetadata = {
  selectedSdg?: SelectedSdg;
  /** Every mini-plenary / plenary / exit-ticket question, with the logical element it appears on. */
  questions: (QuestionSource & { questionElementId: string })[];
};

const DECK_QUALITY_MARKER = "__LAYAH_DECK_QUALITY__";

export function deckQualityTrailer(meta: DeckQualityMetadata | undefined): string {
  if (!meta || (!meta.selectedSdg && meta.questions.length === 0)) return "";
  // "--" cannot appear inside an HTML comment; JSON never needs it unescaped, so escape it.
  return `\n\n<!--${DECK_QUALITY_MARKER}${JSON.stringify(meta).replace(/--/g, "\\u002d\\u002d")}-->`;
}

export function parseDeckQualityFromOutline(outline: string): DeckQualityMetadata | undefined {
  const idx = outline.indexOf(DECK_QUALITY_MARKER);
  if (idx < 0) return undefined;
  const end = outline.indexOf("-->", idx);
  if (end < 0) return undefined;
  try {
    const raw = JSON.parse(outline.slice(idx + DECK_QUALITY_MARKER.length, end).trim()) as Record<string, unknown>;
    const selectedSdg = parseSelectedSdg(raw.selectedSdg);
    const questions = (Array.isArray(raw.questions) ? raw.questions : []).flatMap((q) => {
      const parsed = parseQuestionSources([q])[0];
      const element = (q as Record<string, unknown> | null)?.questionElementId;
      return parsed && typeof element === "string" ? [{ ...parsed, questionElementId: element }] : [];
    });
    return { ...(selectedSdg ? { selectedSdg } : {}), questions };
  } catch {
    return undefined;
  }
}

/**
 * Attaches the element id, the deck's one SDG and each question to its logical slide. The SDG falls back to the
 * one written on the topic/SDG slide, so older saved lessons get a canonical SDG too.
 */
export function attachEducationalMetadata(
  deck: StructuredLessonSlideModel[],
  meta: DeckQualityMetadata | undefined,
): StructuredLessonSlideModel[] {
  const selectedSdg = meta?.selectedSdg ?? parseSelectedSdg(undefined, deck[2]?.body ?? "");
  return deck.map((slide, index) => {
    const elementId = LOGICAL_ELEMENT_IDS[index] ?? `slide-${index + 1}`;
    const questions: QuestionSource[] = (meta?.questions ?? [])
      .filter((q) => q.questionElementId === elementId)
      .map((q) => ({ questionId: q.questionId, questionText: q.questionText, expectedAnswer: q.expectedAnswer, sourceElementIds: q.sourceElementIds, ...(q.learningObjectiveRef ? { learningObjectiveRef: q.learningObjectiveRef } : {}) }));
    return {
      ...slide,
      educationalMetadata: { elementId, ...(selectedSdg ? { selectedSdg } : {}), ...(questions.length ? { questions } : {}) },
    };
  });
}

export type TeachingEvidence = {
  elementId: string;
  slideNumber: number;
  title: string;
  content: string;
};

export const LOGICAL_ELEMENT_IDS = [
  "title",
  "starter",
  "topic-sdg",
  "objectives",
  "outcomes",
  "main-phase",
  "differentiation",
  "uae-connection",
  "plenary",
  "extended-task",
  "exit-ticket",
  "self-evaluation",
  "takeaway",
] as const;

const SDG_RE = /\b(?:SDG\s*)?(\d{1,2})\s*(?:[-–—:]|\u2014)?\s*([A-Za-z][A-Za-z ,&'\-/]{2,80})/i;

export function parseSelectedSdg(value: unknown, fallbackText = ""): SelectedSdg | undefined {
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const id = Number(item.id ?? item.number ?? item.sdg_id);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (Number.isInteger(id) && id >= 1 && id <= 17 && name) return { id, name, description };
  }
  const match = fallbackText.match(SDG_RE);
  if (!match) return undefined;
  return { id: Number(match[1]), name: match[2]!.replace(/[.]+$/, "").trim(), description: "" };
}

export function selectedSdgLabel(sdg: SelectedSdg): string {
  return `SDG ${sdg.id} — ${sdg.name}`;
}

export function parseQuestionSources(value: unknown): QuestionSource[] {
  if (!Array.isArray(value)) return [];
  const out: QuestionSource[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const questionId = String(item.questionId ?? item.question_id ?? "").trim();
    const questionText = String(item.questionText ?? item.question_text ?? "").trim();
    const expectedAnswer = String(item.expectedAnswer ?? item.expected_answer ?? "").trim();
    const rawSources = item.sourceElementIds ?? item.source_element_ids ?? item.source_slide_ids;
    const sourceElementIds = Array.isArray(rawSources)
      ? rawSources.map((source) => String(source).trim()).filter(Boolean)
      : [];
    const learningObjectiveRef = String(item.learningObjectiveRef ?? item.learning_objective_ref ?? "").trim() || undefined;
    if (questionId && questionText && expectedAnswer && sourceElementIds.length) {
      out.push({ questionId, questionText, expectedAnswer, sourceElementIds, learningObjectiveRef });
    }
  }
  return out;
}

export function teachingEvidencePrompt(evidence: readonly TeachingEvidence[]): string {
  if (!evidence.length) return "No earlier teaching evidence is available. Do not create factual questions.";
  return evidence.map((item) => [
    `SOURCE ELEMENT ID: ${item.elementId}`,
    `EARLIER LOGICAL SLIDE: ${item.slideNumber} — ${item.title}`,
    item.content.trim(),
  ].join("\n")).join("\n\n---\n\n");
}

export const QUESTION_SOURCE_SELF_CHECK =
  "Before finalising the lesson, list each mini plenary, plenary, Hot Seat and exit question and identify the earlier slide where the required knowledge is taught. Rewrite or remove questions with no valid source slide.";

export const TEACHER_TEXT_SELF_CHECK =
  "If a sentence describes what a teacher, school or inspector should do, or makes a compliance claim, move it to teacher guidance rather than the student slide.";

const REGULATOR_RE = /\b(?:KHDA|SPEA|MOE|Ministry of Education)\b/i;
const COMPLIANCE_WORD_RE = /\b(?:align(?:ed|ment|s)?|complian\w*|meets?|standards?|frameworks?|inspect\w*|quality|requirements?|ratings?|accredit\w*)\b/i;
const COMPLIANCE_PHRASE_RE = /\b(?:inspection[- ]ready|inspectors? (?:look|will look) for|meets? (?:the )?quality expectations?|quality standards?)\b/i;

/**
 * A compliance or inspection claim (what a school or inspector expects), as opposed to teaching content. A UAE
 * institution named as learning content ("The Ministry of Education runs the national science fair") is fine; a
 * regulator named next to alignment / standards / inspection language is a claim and belongs in teacher guidance.
 */
export function isComplianceClaim(line: string): boolean {
  return COMPLIANCE_PHRASE_RE.test(line) || (REGULATOR_RE.test(line) && COMPLIANCE_WORD_RE.test(line));
}

const ABILITY_LABEL_RE = /\b(?:Higher Achievers?|Middle Achievers?|Lower Achievers?|High Ability|Low Ability|Weak Students?|Strong Students?)\b/i;
const TEACHER_ADMIN_RE = /\b(?:ask students|tell students|teacher should|monitor students|staff grouping|group students by)\b/i;

export const PROHIBITED_STUDENT_TEXT: readonly { label: string; test: (line: string) => string | undefined }[] = [
  { label: "compliance or inspection claim", test: (l) => (isComplianceClaim(l) ? l.trim() : undefined) },
  { label: "teacher administrative instruction", test: (l) => l.match(TEACHER_ADMIN_RE)?.[0] },
  { label: "ability-group label", test: (l) => l.match(ABILITY_LABEL_RE)?.[0] },
];

export type StudentTextFinding = { slide: number; title: string; label: string; match: string };

/** Every prohibited line on every student-facing slide (one finding per rule per line). */
export function scanStudentFacingText(slides: readonly Pick<StructuredLessonSlideModel, "slideTitle" | "body">[]): StudentTextFinding[] {
  const findings: StudentTextFinding[] = [];
  slides.forEach((slide, index) => {
    for (const line of slide.body.split(/\r?\n/)) {
      for (const rule of PROHIBITED_STUDENT_TEXT) {
        const match = rule.test(line);
        if (match) findings.push({ slide: index + 1, title: slide.slideTitle, label: rule.label, match });
      }
    }
  });
  return findings;
}

/**
 * Converts ability-group labels in saved (pre-change) lessons to the neutral task labels, keeping each task where it
 * was. "Could\nCould: task" (old heading plus the Must-Should-Could tool's inline label) collapses to one label.
 */
export function neutraliseDifferentiationLabels(body: string): string {
  return body
    .replace(/\bHigher Achievers?(?:\s+task)?\b/gi, "Could")
    .replace(/\bMiddle Achievers?(?:\s+task)?\b/gi, "Should")
    .replace(/\bLower Achievers?(?:\s+task)?\b/gi, "Must")
    .replace(/\bHigh Ability\b/gi, "Could")
    .replace(/\bLow Ability\b/gi, "Must")
    .replace(/\bWeak Students?\b/gi, "Must")
    .replace(/\bStrong Students?\b/gi, "Could")
    .replace(/^(Must|Should|Could)[ \t]*\n[ \t]*\1[ \t]*:[ \t]*/gim, "$1\n");
}

export type SdgReference = { slide: number; text: string; id: number; name: string };

export function collectSdgReferences(slides: readonly Pick<StructuredLessonSlideModel, "body">[]): SdgReference[] {
  const refs: SdgReference[] = [];
  slides.forEach((slide, index) => {
    for (const line of slide.body.split(/\r?\n/)) {
      if (!/\b(?:SDG|Sustainable Development Goal)\b/i.test(line)) continue;
      const parsed = parseSelectedSdg(undefined, line);
      if (parsed) refs.push({ slide: index + 1, text: line.trim(), id: parsed.id, name: parsed.name });
    }
  });
  return refs;
}

export function validateSelectedSdg(slides: readonly Pick<StructuredLessonSlideModel, "body">[], selected: SelectedSdg): string[] {
  const expected = selectedSdgLabel(selected).toLowerCase();
  return collectSdgReferences(slides)
    .filter((ref) => ref.id !== selected.id || !expected.includes(ref.name.toLowerCase()) && !ref.name.toLowerCase().includes(selected.name.toLowerCase()))
    .map((ref) => `Slide ${ref.slide}: expected ${selectedSdgLabel(selected)}, found "${ref.text}"`);
}

export type PhysicalQuestionMapping = QuestionSource & {
  questionPhysicalSlide: number;
  sourcePhysicalSlides: number[];
  result: "passed" | "failed" | "uncertain";
  reason?: string;
};

type PhysicalSlideLike = { deckIdx: number; lines: string[]; physicalKind?: string };

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolveQuestionMappingsToPhysicalSlides(
  deck: readonly StructuredLessonSlideModel[],
  physicalSlides: readonly PhysicalSlideLike[],
): PhysicalQuestionMapping[] {
  const elementIndex = new Map<string, number>();
  deck.forEach((slide, index) => elementIndex.set(slide.educationalMetadata?.elementId ?? LOGICAL_ELEMENT_IDS[index] ?? `slide-${index + 1}`, index));
  const result: PhysicalQuestionMapping[] = [];
  deck.forEach((slide, deckIdx) => {
    for (const question of slide.educationalMetadata?.questions ?? []) {
      const needle = comparable(question.questionText);
      const questionPhysicalIndex = physicalSlides.findIndex((physical) =>
        physical.deckIdx === deckIdx && comparable(physical.lines.join(" ")).includes(needle),
      );
      const sourcePhysicalSlides = question.sourceElementIds.flatMap((id) => {
        const sourceDeckIdx = elementIndex.get(id);
        if (sourceDeckIdx === undefined) return [];
        return physicalSlides
          .map((physical, index) => ({ physical, index }))
          .filter(({ physical }) => physical.deckIdx === sourceDeckIdx && physical.physicalKind !== "activity-instructions")
          .map(({ index }) => index + 1);
      });
      const earlier = questionPhysicalIndex >= 0
        ? sourcePhysicalSlides.filter((slideNumber) => slideNumber < questionPhysicalIndex + 1)
        : [];
      const unknownSource = question.sourceElementIds.some((id) => !elementIndex.has(id));
      result.push({
        ...question,
        questionPhysicalSlide: questionPhysicalIndex + 1,
        sourcePhysicalSlides: earlier,
        result: questionPhysicalIndex < 0 || earlier.length === 0 ? (unknownSource ? "uncertain" : "failed") : "passed",
        ...(questionPhysicalIndex < 0 ? { reason: "Question text was not found on its expected physical slide." }
          : earlier.length === 0 ? { reason: "No referenced teaching source occurs on an earlier physical slide." }
          : {}),
      });
    }
  });
  return result;
}

