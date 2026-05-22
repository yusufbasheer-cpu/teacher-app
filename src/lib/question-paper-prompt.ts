import { buildSourceMaterialPromptBlock } from "@/lib/lesson-plan";
import {
  QUESTION_TYPE_SPECS,
  type GenerationMode,
  type QuestionCounts,
  type QuestionPaperDifficulty,
  type QuestionPaperTimeOption,
} from "@/lib/question-paper";

export const QP_PAPER_START = "QUESTION PAPER START";
export const QP_PAPER_END = "QUESTION PAPER END";
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

  const extras: string[] = [];
  if (params.includeAnswerKey) extras.push("a full ANSWER KEY");
  if (params.includeMarkingScheme) extras.push("a MARKING SCHEME with mark allocations");
  if (params.includeModelAnswers) {
    extras.push("model answers for long-answer and case-study questions");
  }

  return `You are an expert examination paper writer for Layah.ai. Create a formal, classroom-ready question paper in clear English (unless the subject requires another language).

${modeBlock}

### Output format (mandatory delimiters)
1. Wrap the student question paper between:
${QP_PAPER_START}
...
${QP_PAPER_END}

2. ${
    params.includeAnswerKey || params.includeMarkingScheme || params.includeModelAnswers
      ? `After the question paper, include:
${params.includeAnswerKey ? `- Answer key between ${QP_ANSWER_KEY_START} and ${QP_ANSWER_KEY_END}` : ""}
${params.includeMarkingScheme ? `- Marking scheme between ${QP_MARKING_SCHEME_START} and ${QP_MARKING_SCHEME_END}` : ""}
${params.includeModelAnswers ? "- Within the answer key, provide detailed model answers for long-answer and case-study items." : ""}`
      : "Do not include an answer key or marking scheme."
  }

### Question paper structure (inside ${QP_PAPER_START})
- Header block with blank lines labeled: School Name, Student Name, Date, Class
- Then show: Subject, Grade, Topic, Total Marks, Time Allowed
- Group questions by type with clear section headings matching the requested types
- Number all questions sequentially across the whole paper (1, 2, 3…)
- Show marks in brackets after each question, e.g. (2 marks)
- Total marks across all questions must equal the requested total exactly
- MCQ: always provide options A, B, C, D on separate lines
- Match the Following: two labeled columns
- Diagram Based: describe what to draw/label if no image is available
- Leave adequate spacing between questions for student answers
- Do not include answers on the student paper

Use plain text suitable for Word export (headings with ##, bullets with -, numbered lists).`;
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

  return `Create a question paper with these specifications:

- Subject: ${params.subject}
- Grade: ${params.grade}
- Curriculum: ${params.curriculumType}
- Topic / Chapter: ${params.topic}
- Total marks: ${params.totalMarks} (must sum exactly)
- Time allowed: ${params.timeAllowed}
- Difficulty: ${params.difficulty}

### Required question types and counts
${typeBlock}
${sourceBlock}`;
}
