import { NextResponse } from "next/server";
import { callDeepSeekChat } from "@/lib/question-paper-deepseek";
import { parseQuestionPaperResponse } from "@/lib/parse-question-paper";
import {
  buildQuestionPaperSystemPrompt,
  buildQuestionPaperUserMessage,
} from "@/lib/question-paper-prompt";
import {
  buildQuestionPaperSourceMaterial,
  validateQuestionPaperBody,
  type QuestionPaperGenerateBody,
} from "@/lib/question-paper";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEEPSEEK_MAX_TOKENS_PAPER = 8000;

export async function POST(req: Request) {
  let body: QuestionPaperGenerateBody;
  try {
    body = (await req.json()) as QuestionPaperGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateQuestionPaperBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const sourceMaterial = buildQuestionPaperSourceMaterial({
    pastedContent: body.pastedContent,
    uploadedExtractedText: body.sourceMaterial,
  });

  const systemPrompt = buildQuestionPaperSystemPrompt({
    mode: body.generationMode,
    enhancementPercent: body.generationMode === "enhanced" ? body.enhancementPercent : 0,
    includeAnswerKey: body.includeAnswerKey,
    includeMarkingScheme: body.includeMarkingScheme,
    includeModelAnswers: body.includeModelAnswers,
  });

  const userMessage = buildQuestionPaperUserMessage({
    subject: body.subject.trim(),
    grade: body.grade.trim(),
    topic: body.topic.trim(),
    curriculumType: body.curriculumType.trim(),
    totalMarks: Number(body.totalMarks),
    timeAllowed: body.timeAllowed,
    difficulty: body.difficulty,
    questionCounts: body.questionCounts,
    sourceMaterial,
  });

  const ds = await callDeepSeekChat({
    logLabel: "question-paper-call-1",
    systemPrompt,
    userMessage,
    maxTokens: DEEPSEEK_MAX_TOKENS_PAPER,
    temperature: body.generationMode === "strict" ? 0.35 : 0.55,
  });

  if ("error" in ds) {
    return NextResponse.json({ error: ds.error }, { status: 502 });
  }

  const parsed = parseQuestionPaperResponse(ds.content);

  return NextResponse.json({
    questionPaper: parsed.questionPaper,
    ...(parsed.answerKey ? { answerKey: parsed.answerKey } : {}),
    ...(parsed.markingScheme ? { markingScheme: parsed.markingScheme } : {}),
    ...(parsed.parseNotice ? { parseNotice: parsed.parseNotice } : {}),
  });
}
