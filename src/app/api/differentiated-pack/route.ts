import { NextResponse } from "next/server";
import {
  buildDiffPackLevelSystemPrompt,
  buildDiffPackUserMessage,
  type DifferentiatedLevel,
} from "@/lib/differentiated-pack-prompts";
import { apiErrorResponse } from "@/lib/api-client-error";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";
import { USER_FACING_ERROR } from "@/lib/user-facing-errors";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import { countFilledPackSections, parseDifferentiatedPack } from "@/lib/parse-differentiated-pack";
import { authenticateRequest, getCallerPlanType } from "@/lib/user-usage-server";
import { PLANS, FEATURE_LOCKED_ERROR_CODE } from "@/lib/plans";
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
export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MAX_TOKENS = 2600;

function deepSeekHttpErrorMessage(status: number, rawBody: string): string {
  const trimmed = rawBody.trim();
  if (status === 401) {
    return "DeepSeek API key is invalid or expired. Please update DEEPSEEK_API_KEY.";
  }
  if (status === 402) {
    return "DeepSeek account has insufficient credits. Please top up your DeepSeek balance.";
  }
  if (status === 429) {
    return "DeepSeek rate limit reached. Please retry in a few moments.";
  }
  return `DeepSeek HTTP ${status}: ${trimmed.slice(0, 800) || "No response body."}`;
}

type GenerateBody = {
  level?: DifferentiatedLevel;
  topic?: string;
  subject?: string;
  grade?: string;
  learningObjectives?: string;
  curriculumType?: string;
  curriculumFramework?: string;
  lessonSourceText?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`differentiated-pack:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const planType = await getCallerPlanType(auth.supabase, auth.userId);
  if (!PLANS[planType].differentiatedWorksheets) {
    return NextResponse.json(
      {
        error: "Differentiated Worksheets is a Pro feature. Upgrade to Pro to generate worksheet packs.",
        code: FEATURE_LOCKED_ERROR_CODE,
      },
      { status: 403 },
    );
  }

  const userDayLimit = checkRateLimit(`differentiated-pack:user:${auth.userId}`, 30, DAY_MS);
  if (!userDayLimit.ok) return rateLimitResponse(userDayLimit.resetInSeconds);

  const spending = checkSpendingProtection(auth.userId);
  if (spending.blocked) {
    if (spending.shouldAlert) {
      void sendEmail({
        to: "info@layah.in",
        subject: "Layah Spending Alert — User Blocked",
        text: `User ${auth.userId} exceeded 50 API calls in one hour and has been automatically blocked.\n\nEndpoint: /api/differentiated-pack\nTime: ${new Date().toISOString()}`,
      });
    }
    return rateLimitResponse(spending.resetInSeconds);
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return apiErrorResponse("Missing DEEPSEEK_API_KEY", 500, "differentiated-pack");
  }
  if (apiKey.length < 12) {
    return apiErrorResponse("DEEPSEEK_API_KEY too short", 500, "differentiated-pack");
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const topic = body.topic?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const grade = body.grade?.trim() ?? "";
  const learningObjectives = body.learningObjectives?.trim() ?? "";
  const lessonSourceText = body.lessonSourceText?.trim() ?? "";
  const level = body.level;

  if (level !== "foundation" && level !== "core" && level !== "extension") {
    return NextResponse.json(
      { error: "level is required and must be foundation, core, or extension." },
      { status: 400 },
    );
  }

  if (!topic || !subject || !grade || !learningObjectives) {
    return NextResponse.json(
      { error: "topic, subject, grade, and learningObjectives are required." },
      { status: 400 },
    );
  }
  if (!lessonSourceText) {
    return NextResponse.json(
      { error: "lessonSourceText is required (lesson plan or extracted document text)." },
      { status: 400 },
    );
  }

  const userMessage = buildDiffPackUserMessage({
    level,
    topic,
    subject,
    grade,
    learningObjectives,
    curriculumType: body.curriculumType,
    curriculumFramework: body.curriculumFramework,
    lessonSourceText,
  });

  let deepseekResponse: Response;
  try {
    deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.45,
        max_tokens: DEEPSEEK_MAX_TOKENS,
        messages: [
          { role: "system", content: buildDiffPackLevelSystemPrompt(level) },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (e) {
    console.error("[differentiated-pack] DeepSeek fetch error:", e);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const rawBody = await deepseekResponse.text();
  logDeepSeekRawResponse(`differentiated-pack:${level}`, deepseekResponse, rawBody);
  if (!deepseekResponse.ok) {
    console.error(
      "[differentiated-pack] DeepSeek HTTP error:",
      deepSeekHttpErrorMessage(deepseekResponse.status, rawBody),
    );
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
  if (!content?.trim()) {
    console.error("[differentiated-pack] empty model response:", errorMessage);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 502 });
  }

  const pack = parseDifferentiatedPack(content);
  const filled = countFilledPackSections(pack);
  const parseNotice =
    filled < 6
      ? `Only ${filled}/6 expected sections were detected from markers for ${level}.`
      : undefined;

  return NextResponse.json({
    level,
    pack,
    meta: { topic, subject, grade },
    ...(parseNotice ? { parseNotice } : {}),
    ...(errorMessage && filled > 0 ? { recoveryNotice: errorMessage } : {}),
  });
}
