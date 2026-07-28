import { NextResponse } from "next/server";
import { callDeepSeekChat } from "@/lib/question-paper-deepseek";
import { parseBlueprintPlainTextResponse } from "@/lib/parse-question-paper-blueprint";
import { USER_FACING_ERROR } from "@/lib/user-facing-errors";
import {
  buildBlueprintSystemPrompt,
  buildBlueprintUserMessage,
} from "@/lib/question-paper-prompt";
import {
  isValidDifficulty,
  isValidTimeAllowed,
  type QuestionPaperDifficulty,
  type QuestionPaperTimeOption,
} from "@/lib/question-paper";
import { authenticateRequest } from "@/lib/user-usage-server";
import {
  checkRateLimit,
  checkSpendingProtection,
  getClientIp,
  rateLimitResponse,
  HOUR_MS,
  DAY_MS,
} from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEEPSEEK_MAX_TOKENS_BLUEPRINT = 4000;

type BlueprintBody = {
  subject?: string;
  grade?: string;
  topic?: string;
  curriculumType?: string;
  totalMarks?: number;
  timeAllowed?: string;
  difficulty?: string;
  questionPaper?: string;
  answerKey?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`question-paper-blueprint:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const userDayLimit = checkRateLimit(`question-paper-blueprint:user:${auth.userId}`, 30, DAY_MS);
  if (!userDayLimit.ok) return rateLimitResponse(userDayLimit.resetInSeconds);

  const spending = checkSpendingProtection(auth.userId);
  if (spending.blocked) {
    if (spending.shouldAlert) {
      void sendEmail({
        to: "info@layah.in",
        subject: "Layah Spending Alert — User Blocked",
        text: `User ${auth.userId} exceeded 50 API calls in one hour and has been automatically blocked.\n\nEndpoint: /api/question-paper/blueprint\nTime: ${new Date().toISOString()}`,
      });
    }
    return rateLimitResponse(spending.resetInSeconds);
  }

  let body: BlueprintBody;
  try {
    body = (await req.json()) as BlueprintBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim();
  const questionPaper = body.questionPaper?.trim();
  const totalMarks = Number(body.totalMarks);

  if (!subject || !grade || !topic || !questionPaper) {
    return NextResponse.json(
      { error: "subject, grade, topic, and questionPaper are required." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    return NextResponse.json({ error: "totalMarks must be a positive number." }, { status: 400 });
  }

  const timeRaw = body.timeAllowed?.trim() ?? "1 hour";
  const diffRaw = body.difficulty?.trim() ?? "Medium";
  const timeAllowed: QuestionPaperTimeOption = isValidTimeAllowed(timeRaw) ? timeRaw : "1 hour";
  const difficulty: QuestionPaperDifficulty = isValidDifficulty(diffRaw) ? diffRaw : "Medium";

  const ds = await callDeepSeekChat({
    logLabel: "question-paper-call-2-blueprint",
    systemPrompt: buildBlueprintSystemPrompt(),
    userMessage: buildBlueprintUserMessage({
      subject,
      grade,
      topic,
      curriculumType: body.curriculumType?.trim() ?? "",
      totalMarks,
      timeAllowed,
      difficulty,
      questionPaper,
      answerKey: body.answerKey,
    }),
    maxTokens: DEEPSEEK_MAX_TOKENS_BLUEPRINT,
    temperature: 0.4,
  });

  if ("error" in ds) {
    console.error("[question-paper-blueprint]", ds.error);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const parsed = parseBlueprintPlainTextResponse(ds.content);
  if (!parsed.blueprintText) {
    console.error("[question-paper-blueprint] parse failed", parsed.error);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  return NextResponse.json({
    blueprintText: parsed.blueprintText,
  });
}
