import { NextResponse } from "next/server";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";
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

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MAX_TOKENS = 8000;

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

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY in environment variables." },
      { status: 500 },
    );
  }
  if (apiKey.length < 12) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY appears invalid (too short)." },
      { status: 500 },
    );
  }

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
        temperature: body.generationMode === "strict" ? 0.35 : 0.55,
        max_tokens: DEEPSEEK_MAX_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DeepSeek request failed: ${msg}` }, { status: 502 });
  }

  const rawBody = await deepseekResponse.text();
  logDeepSeekRawResponse("question-paper", deepseekResponse, rawBody);

  if (!deepseekResponse.ok) {
    return NextResponse.json(
      { error: deepSeekHttpErrorMessage(deepseekResponse.status, rawBody) },
      { status: 502 },
    );
  }

  const completion = parseDeepSeekCompletionBody(rawBody);
  const completionText = completion.content?.trim();
  if (!completionText) {
    return NextResponse.json(
      { error: completion.errorMessage ?? "DeepSeek returned no content." },
      { status: 502 },
    );
  }

  const parsed = parseQuestionPaperResponse(completionText);

  return NextResponse.json({
    questionPaper: parsed.questionPaper,
    ...(parsed.answerKey ? { answerKey: parsed.answerKey } : {}),
    ...(parsed.markingScheme ? { markingScheme: parsed.markingScheme } : {}),
    ...(parsed.parseNotice ? { parseNotice: parsed.parseNotice } : {}),
  });
}
