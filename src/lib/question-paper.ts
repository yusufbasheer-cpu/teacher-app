import {
  CURRICULUM_TYPE_OPTIONS,
  GRADE_YEAR_OPTIONS,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
  buildGenerationSourceMaterial,
  SOURCE_MATERIAL_MAX_CHARS,
} from "@/lib/lesson-plan";

export const QUESTION_PAPER_TIME_OPTIONS = [
  "30 minutes",
  "45 minutes",
  "1 hour",
  "1.5 hours",
  "2 hours",
  "3 hours",
] as const;

export type QuestionPaperTimeOption = (typeof QUESTION_PAPER_TIME_OPTIONS)[number];

export const QUESTION_PAPER_DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Mixed"] as const;
export type QuestionPaperDifficulty = (typeof QUESTION_PAPER_DIFFICULTY_OPTIONS)[number];

export type QuestionTypeId =
  | "mcq"
  | "trueFalse"
  | "fillBlanks"
  | "matchFollowing"
  | "oneWord"
  | "shortAnswer"
  | "longAnswer"
  | "definition"
  | "diagram"
  | "sequenceOrder"
  | "errorCorrection"
  | "caseStudy";

export type QuestionTypeSpec = {
  id: QuestionTypeId;
  label: string;
  description: string;
  defaultMarks: number;
};

export const QUESTION_TYPE_SPECS: readonly QuestionTypeSpec[] = [
  { id: "mcq", label: "Multiple Choice Questions (MCQ)", description: "4 options each (A–D)", defaultMarks: 1 },
  { id: "trueFalse", label: "True or False", description: "Statement with T/F response", defaultMarks: 1 },
  { id: "fillBlanks", label: "Fill in the Blanks", description: "Sentences with gaps", defaultMarks: 1 },
  { id: "matchFollowing", label: "Match the Following", description: "Two columns to match", defaultMarks: 2 },
  { id: "oneWord", label: "One Word Answer", description: "Brief single-word or phrase", defaultMarks: 1 },
  { id: "shortAnswer", label: "Short Answer", description: "2–3 lines expected", defaultMarks: 2 },
  { id: "longAnswer", label: "Long Answer", description: "Paragraph response", defaultMarks: 5 },
  { id: "definition", label: "Definition Questions", description: "Define key terms", defaultMarks: 2 },
  { id: "diagram", label: "Diagram Based Questions", description: "Label, draw, or interpret", defaultMarks: 3 },
  { id: "sequenceOrder", label: "Sequence and Order Questions", description: "Order steps or events", defaultMarks: 2 },
  { id: "errorCorrection", label: "Error Correction Questions", description: "Find and correct errors", defaultMarks: 2 },
  { id: "caseStudy", label: "Case Study Based Questions", description: "Scenario with sub-questions", defaultMarks: 5 },
] as const;

export type QuestionCounts = Record<QuestionTypeId, number>;

export function emptyQuestionCounts(): QuestionCounts {
  return Object.fromEntries(QUESTION_TYPE_SPECS.map((s) => [s.id, 0])) as QuestionCounts;
}

export type GenerationMode = "strict" | "enhanced";

export type QuestionPaperFormInput = {
  curriculumType: string;
  grade: string;
  subject: string;
  topic: string;
  totalMarks: number;
  timeAllowed: QuestionPaperTimeOption;
  difficulty: QuestionPaperDifficulty;
  questionCounts: QuestionCounts;
  generationMode: GenerationMode;
  enhancementPercent: number;
  includeAnswerKey: boolean;
  includeMarkingScheme: boolean;
  includeModelAnswers: boolean;
};

export type QuestionPaperGenerateBody = QuestionPaperFormInput & {
  sourceMaterial?: string;
  pastedContent?: string;
};

export type QuestionPaperResult = {
  questionPaper: string;
  answerKey?: string;
  markingScheme?: string;
  parseNotice?: string;
};

export function isValidTimeAllowed(value: string): value is QuestionPaperTimeOption {
  return (QUESTION_PAPER_TIME_OPTIONS as readonly string[]).includes(value);
}

export function isValidDifficulty(value: string): value is QuestionPaperDifficulty {
  return (QUESTION_PAPER_DIFFICULTY_OPTIONS as readonly string[]).includes(value);
}

export function countSelectedQuestions(counts: QuestionCounts): number {
  return QUESTION_TYPE_SPECS.reduce((sum, s) => sum + Math.max(0, counts[s.id] ?? 0), 0);
}

/** Preview mark weights before AI allocation (proportional to default marks × count). */
export function estimateMarksPreview(totalMarks: number, counts: QuestionCounts): number {
  const totalQ = countSelectedQuestions(counts);
  if (totalQ <= 0 || totalMarks <= 0) return 0;
  return totalMarks;
}

export function getQuestionPaperTimeEstimate(questionCount: number): {
  tier: string;
  detail: string;
  seconds: number;
} {
  if (questionCount <= 0) {
    return { tier: "—", detail: "Select at least one question", seconds: 0 };
  }
  const seconds = Math.min(420, Math.max(20, 18 + questionCount * 4));
  const tier = seconds < 45 ? "Fast" : seconds < 120 ? "Medium" : "Full paper";
  const mins = Math.ceil(seconds / 60);
  return { tier, detail: `~${mins} min (${seconds}s)`, seconds };
}

export function validateQuestionPaperBody(body: QuestionPaperGenerateBody): string | null {
  if (!body.subject?.trim() || !isValidSubjectOption(body.subject)) {
    return "Valid subject is required.";
  }
  if (!body.grade?.trim() || !isValidGradeYear(body.grade)) {
    return "Valid grade is required.";
  }
  if (!body.curriculumType?.trim() || !isValidCurriculumType(body.curriculumType)) {
    return "Valid curriculum type is required.";
  }
  if (!body.topic?.trim()) {
    return "Topic or chapter name is required.";
  }
  const marks = Number(body.totalMarks);
  if (!Number.isFinite(marks) || marks < 1 || marks > 500) {
    return "Total marks must be between 1 and 500.";
  }
  if (!isValidTimeAllowed(body.timeAllowed)) {
    return "Valid time allowed is required.";
  }
  if (!isValidDifficulty(body.difficulty)) {
    return "Valid difficulty level is required.";
  }
  if (body.generationMode !== "strict" && body.generationMode !== "enhanced") {
    return "Generation mode must be strict or enhanced.";
  }
  const pct = Number(body.enhancementPercent);
  if (body.generationMode === "enhanced" && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return "Enhancement level must be 0–100.";
  }
  const totalQ = countSelectedQuestions(body.questionCounts ?? emptyQuestionCounts());
  if (totalQ < 1) {
    return "Select at least one question in any type.";
  }
  if (body.generationMode === "strict") {
    const src =
      buildGenerationSourceMaterial({
        pastedContent: body.pastedContent,
        uploadedExtractedText: body.sourceMaterial,
      }) ?? "";
    if (!src.trim()) {
      return "Strict mode requires uploaded or pasted content.";
    }
  }
  return null;
}

export function buildQuestionPaperSourceMaterial(params: {
  pastedContent?: string;
  uploadedExtractedText?: string;
}): string | undefined {
  return buildGenerationSourceMaterial(params)?.slice(0, SOURCE_MATERIAL_MAX_CHARS);
}

export { CURRICULUM_TYPE_OPTIONS, GRADE_YEAR_OPTIONS };
