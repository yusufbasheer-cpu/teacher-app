import { NextResponse } from "next/server";
import {
  DIFF_PACK_SYSTEM_PROMPT,
  buildDiffPackUserMessage,
} from "@/lib/differentiated-pack-prompts";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import { countFilledPackSections, parseDifferentiatedPack } from "@/lib/parse-differentiated-pack";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MAX_TOKENS = 8000;

type GenerateBody = {
  topic?: string;
  subject?: string;
  grade?: string;
  learningObjectives?: string;
  curriculumType?: string;
  curriculumFramework?: string;
  lessonSourceText?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY in environment variables." },
      { status: 500 },
    );
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
          { role: "system", content: DIFF_PACK_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `DeepSeek request failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const rawBody = await deepseekResponse.text();
  if (!deepseekResponse.ok) {
    return NextResponse.json(
      { error: `DeepSeek HTTP ${deepseekResponse.status}: ${rawBody.slice(0, 800)}` },
      { status: 502 },
    );
  }

  const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
  if (!content?.trim()) {
    return NextResponse.json(
      { error: errorMessage ?? "Empty model response." },
      { status: 502 },
    );
  }

  const pack = parseDifferentiatedPack(content);
  const filled = countFilledPackSections(pack);
  const parseNotice =
    filled < 8
      ? `Only ${filled}/8 sections were detected from markers. You can regenerate or copy from filled sections.`
      : undefined;

  return NextResponse.json({
    pack,
    meta: { topic, subject, grade },
    ...(parseNotice ? { parseNotice } : {}),
    ...(errorMessage && filled > 0 ? { recoveryNotice: errorMessage } : {}),
  });
}
