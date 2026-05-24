import { NextResponse } from "next/server";
import { callDeepSeekChat } from "@/lib/question-paper-deepseek";
import {
  assertCanGenerate,
  authenticateRequest,
  recordSuccessfulGeneration,
} from "@/lib/user-usage-server";
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
import { USER_FACING_ERROR } from "@/lib/user-facing-errors";

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

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const gate = await assertCanGenerate(auth.supabase, auth.userId);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code, usage: gate.usage },
      { status: gate.status },
    );
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
    console.error("[question-paper]", ds.error);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const parsed = parseQuestionPaperResponse(ds.content);

  if (!parsed.questionPaper?.trim()) {
    console.error("[question-paper] empty question paper from model");
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const usage = await recordSuccessfulGeneration(
    auth.supabase,
    auth.userId,
    auth.accessToken,
  );

  return NextResponse.json({
    questionPaper: parsed.questionPaper,
    ...(parsed.answerKey ? { answerKey: parsed.answerKey } : {}),
    ...(parsed.markingScheme ? { markingScheme: parsed.markingScheme } : {}),
    ...(parsed.parseNotice ? { parseNotice: parsed.parseNotice } : {}),
    ...(usage ? { usage } : {}),
  });
}
