import { NextResponse } from "next/server";
import { callDeepSeekChat } from "@/lib/question-paper-deepseek";
import {
  authenticateRequest,
  refundGeneration,
  reserveGeneration,
} from "@/lib/user-usage-server";
import {
  checkRateLimit,
  checkSpendingProtection,
  getClientIp,
  rateLimitResponse,
  HOUR_MS,
  DAY_MS,
} from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";
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
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`question-paper:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

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

  const userDayLimit = checkRateLimit(`question-paper:user:${auth.userId}`, 30, DAY_MS);
  if (!userDayLimit.ok) return rateLimitResponse(userDayLimit.resetInSeconds);

  const spending = checkSpendingProtection(auth.userId);
  if (spending.blocked) {
    if (spending.shouldAlert) {
      void sendEmail({
        to: "info@layah.in",
        subject: "Layah Spending Alert — User Blocked",
        text: `User ${auth.userId} exceeded 50 API calls in one hour and has been automatically blocked.\n\nEndpoint: /api/question-paper\nTime: ${new Date().toISOString()}`,
      });
    }
    return rateLimitResponse(spending.resetInSeconds);
  }

  const gate = await reserveGeneration(auth.supabase, auth.userId);
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
    await refundGeneration(gate.reservation);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const parsed = parseQuestionPaperResponse(ds.content);

  if (!parsed.questionPaper?.trim()) {
    console.error("[question-paper] empty question paper from model");
    await refundGeneration(gate.reservation);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  return NextResponse.json({
    questionPaper: parsed.questionPaper,
    ...(parsed.answerKey ? { answerKey: parsed.answerKey } : {}),
    ...(parsed.markingScheme ? { markingScheme: parsed.markingScheme } : {}),
    ...(parsed.parseNotice ? { parseNotice: parsed.parseNotice } : {}),
    usage: gate.usage,
  });
}
