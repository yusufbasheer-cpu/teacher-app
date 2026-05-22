import { buildSourceMaterialPromptBlock } from "@/lib/lesson-plan";
import {
  QUESTION_TYPE_SPECS,
  type GenerationMode,
  type QuestionCounts,
  type QuestionPaperDifficulty,
  type QuestionPaperTimeOption,
} from "@/lib/question-paper";

/** Primary markers (underscore form). */
export const QP_PAPER_START = "QUESTION_PAPER_START";
export const QP_PAPER_END = "QUESTION_PAPER_END";
export const QP_BLUEPRINT_START = "BLUEPRINT_START";
export const QP_BLUEPRINT_END = "BLUEPRINT_END";

/** Legacy / alternate markers still accepted when parsing. */
export const QP_PAPER_START_ALIASES = [QP_PAPER_START, "QUESTION PAPER START"] as const;

export const QP_ANSWER_KEY_START = "ANSWER KEY START";
export const QP_ANSWER_KEY_END = "ANSWER KEY END";
export const QP_MARKING_SCHEME_START = "MARKING SCHEME START";
export const QP_MARKING_SCHEME_END = "MARKING SCHEME END";

function formatQuestionTypeRequest(counts: QuestionCounts): string {
  const lines: string[] = [];
  for (const spec of QUESTION_TYPE_SPECS) {
    const n = counts[spec.id] ?? 0;
    if (n > 0) {
      lines.push(`- ${spec.label}: exactly ${n} question(s) — ${spec.description}`);
    }
  }
  return lines.join("\n");
}

function enhancementGuidance(percent: number): string {
  if (percent <= 20) {
    return "Stay mostly on the teacher's content with slight rewording only.";
  }
  if (percent <= 50) {
    return "Balance the teacher's content with moderate AI enhancement and paraphrasing.";
  }
  if (percent <= 80) {
    return "Use the teacher's content as a base but mostly enhance and extend with AI.";
  }
  return "Generate freely from topic knowledge; teacher content is optional background.";
}

/** Call 1 — question paper only (no blueprint). */
export function buildQuestionPaperSystemPrompt(params: {
  mode: GenerationMode;
  enhancementPercent: number;
  includeAnswerKey: boolean;
  includeMarkingScheme: boolean;
  includeModelAnswers: boolean;
}): string {
  const modeBlock =
    params.mode === "strict"
      ? `Generate questions STRICTLY and ONLY from the provided content. Do not add any information not present in the provided content. Every question must be directly traceable to the provided content.`
      : `Generate questions based on the provided content and topic. You may paraphrase, expand, and enhance questions. Enhancement level is ${params.enhancementPercent}% — ${enhancementGuidance(params.enhancementPercent)}`;

  return `You are an expert examination paper writer for Layah.ai. Output ONLY the question paper (and answer key sections if requested). Do NOT output a blueprint or JSON.

### Mandatory delimiters — question paper
Wrap the student question paper exactly between these two lines (no text outside except optional answer key blocks after ${QP_PAPER_END}):

${QP_PAPER_START}
(question paper content here)
${QP_PAPER_END}

${
  params.includeAnswerKey || params.includeMarkingScheme || params.includeModelAnswers
    ? `Optional sections AFTER ${QP_PAPER_END} only:
${params.includeAnswerKey ? `- Answer key: ${QP_ANSWER_KEY_START} … ${QP_ANSWER_KEY_END}` : ""}
${params.includeMarkingScheme ? `- Marking scheme: ${QP_MARKING_SCHEME_START} … ${QP_MARKING_SCHEME_END}` : ""}
${params.includeModelAnswers ? "- Include model answers for long-answer and case-study items inside the answer key." : ""}`
    : "Do not include an answer key or marking scheme."
}

### Inside ${QP_PAPER_START} … ${QP_PAPER_END}
- Header: School Name, Student Name, Date, Class (blank lines)
- Subject, Grade, Topic, Total Marks, Time Allowed
- Group by question type; number questions 1, 2, 3… across the paper
- Show marks per question e.g. (2 marks); total marks must match the request
- MCQ: options A, B, C, D on separate lines
- No answers on the student paper

Use plain text (## headings, bullets, numbered lists). Do not use JSON.`;
}

export function buildQuestionPaperUserMessage(params: {
  subject: string;
  grade: string;
  topic: string;
  curriculumType: string;
  totalMarks: number;
  timeAllowed: QuestionPaperTimeOption;
  difficulty: QuestionPaperDifficulty;
  questionCounts: QuestionCounts;
  sourceMaterial?: string;
}): string {
  const typeBlock = formatQuestionTypeRequest(params.questionCounts);
  const sourceBlock = params.sourceMaterial?.trim()
    ? buildSourceMaterialPromptBlock(params.sourceMaterial)
    : "\n\nNo teacher source material was provided — generate from the topic using curriculum-appropriate knowledge.";

  return `Create ONLY the question paper (use ${QP_PAPER_START} and ${QP_PAPER_END} markers).

- Subject: ${params.subject}
- Grade: ${params.grade}
- Curriculum: ${params.curriculumType}
- Topic / Chapter: ${params.topic}
- Total marks: ${params.totalMarks}
- Time allowed: ${params.timeAllowed}
- Difficulty: ${params.difficulty}

### Required question types and counts
${typeBlock}
${sourceBlock}`;
}

/** Call 2 — blueprint only (plain text tables, analyzed from finished paper). */
export function buildBlueprintSystemPrompt(): string {
  return `You are an examination blueprint analyst for Layah.ai. You will receive a completed question paper. Analyze it and produce an examination BLUEPRINT as plain text only.

### Mandatory delimiters
Wrap the entire blueprint between:

${QP_BLUEPRINT_START}
(blueprint content here)
${QP_BLUEPRINT_END}

### Required sections (plain text tables — NOT JSON)
Use markdown-style pipe tables or clear column layouts. Include:

## TABLE 1 — Chapter-wise distribution
| Chapter / Topic | Questions | Marks | % of paper |
(one row per chapter/topic represented in the paper)

## TABLE 2 — Bloom's taxonomy distribution
| Level | Questions | Marks | % of paper |
Rows for: Remember, Understand, Apply, Analyze, Evaluate, Create

## TABLE 3 — Question type distribution
| Question type | Questions | Marks per question | Total marks |

## TABLE 4 — Difficulty distribution
| Difficulty | Questions | Marks |
Rows for Easy, Medium, Hard

## BLUEPRINT SUMMARY
- Total questions:
- Total marks:
- Estimated completion time:
- Syllabus coverage %:

Rules:
- Base all numbers on the supplied question paper (infer Bloom level and difficulty from each question).
- Percentages should sum to approximately 100% where applicable.
- Do NOT output JSON, code blocks, or a second copy of the question paper.
- Output ONLY the blueprint between ${QP_BLUEPRINT_START} and ${QP_BLUEPRINT_END}.`;
}

export function buildBlueprintUserMessage(params: {
  subject: string;
  grade: string;
  topic: string;
  curriculumType: string;
  totalMarks: number;
  timeAllowed: QuestionPaperTimeOption;
  difficulty: QuestionPaperDifficulty;
  questionPaper: string;
  answerKey?: string;
}): string {
  const extras = params.answerKey?.trim()
    ? `\n\n### Answer key (for your analysis only)\n${params.answerKey.trim()}`
    : "";

  return `Analyze this question paper and write the blueprint (plain text tables only, between ${QP_BLUEPRINT_START} and ${QP_BLUEPRINT_END}).

- Subject: ${params.subject}
- Grade: ${params.grade}
- Curriculum: ${params.curriculumType}
- Topic: ${params.topic}
- Target total marks: ${params.totalMarks}
- Time allowed: ${params.timeAllowed}
- Difficulty setting: ${params.difficulty}

### Question paper to analyze
${params.questionPaper.trim()}
${extras}`;
}
