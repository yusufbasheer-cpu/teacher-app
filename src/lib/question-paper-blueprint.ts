/** Structured examination blueprint returned with the question paper. */

export type BlueprintChapterRow = {
  chapter: string;
  questions: number;
  marks: number;
  percent: number;
};

export type BlueprintBloomsLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";

export type BlueprintBloomsRow = {
  level: BlueprintBloomsLevel;
  questions: number;
  marks: number;
  percent: number;
};

export type BlueprintQuestionTypeRow = {
  type: string;
  questions: number;
  marksPerQuestion: number;
  totalMarks: number;
};

export type BlueprintDifficultyRow = {
  level: "Easy" | "Medium" | "Hard";
  questions: number;
  marks: number;
};

export type BlueprintSummary = {
  totalQuestions: number;
  totalMarks: number;
  estimatedCompletionTime: string;
  syllabusCoveragePercent: number;
};

export type QuestionPaperBlueprint = {
  chapterWise: BlueprintChapterRow[];
  bloomsTaxonomy: BlueprintBloomsRow[];
  questionTypes: BlueprintQuestionTypeRow[];
  difficulty: BlueprintDifficultyRow[];
  summary: BlueprintSummary;
};

export const BLOOMS_LEVELS: readonly BlueprintBloomsLevel[] = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
] as const;

export function formatBlueprintPreviewMarkdown(bp: QuestionPaperBlueprint): string {
  const lines: string[] = ["# Examination Blueprint", ""];
  lines.push("## Table 1 — Chapter-wise distribution", "");
  lines.push("| Chapter | Questions | Marks | % of paper |");
  lines.push("|---------|-----------|-------|------------|");
  for (const r of bp.chapterWise) {
    lines.push(`| ${r.chapter} | ${r.questions} | ${r.marks} | ${r.percent}% |`);
  }
  lines.push("", "## Table 2 — Bloom's taxonomy", "");
  lines.push("| Level | Questions | Marks | % |");
  lines.push("|-------|-----------|-------|---|");
  for (const r of bp.bloomsTaxonomy) {
    lines.push(`| ${r.level} | ${r.questions} | ${r.marks} | ${r.percent}% |`);
  }
  lines.push("", "## Table 3 — Question type distribution", "");
  lines.push("| Type | Questions | Marks each | Total marks |");
  lines.push("|------|-----------|------------|-------------|");
  for (const r of bp.questionTypes) {
    lines.push(`| ${r.type} | ${r.questions} | ${r.marksPerQuestion} | ${r.totalMarks} |`);
  }
  lines.push("", "## Table 4 — Difficulty distribution", "");
  lines.push("| Level | Questions | Marks |");
  lines.push("|-------|-----------|-------|");
  for (const r of bp.difficulty) {
    lines.push(`| ${r.level} | ${r.questions} | ${r.marks} |`);
  }
  lines.push("", "## Summary", "");
  lines.push(`- Total questions: ${bp.summary.totalQuestions}`);
  lines.push(`- Total marks: ${bp.summary.totalMarks}`);
  lines.push(`- Estimated completion time: ${bp.summary.estimatedCompletionTime}`);
  lines.push(`- Syllabus coverage: ${bp.summary.syllabusCoveragePercent}%`);
  return lines.join("\n");
}
