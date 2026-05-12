import { NextResponse } from "next/server";
import { looksLikeJsonObject, parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

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
  return trimmed.slice(0, 600) || `DeepSeek HTTP ${status} with empty response body.`;
}

const SYSTEM = `You read lesson plan text and return ONLY valid JSON (no markdown fences) with keys:
topic (string), subject (string), grade (string), learningObjectives (string).
Infer sensible values from headings and body if labels are missing. Use English. Grade examples: "Grade 7", "Year 9".`;

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "Missing DEEPSEEK_API_KEY." }, { status: 500 });
  }
  if (apiKey.length < 12) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY appears invalid (too short). Please check your environment variable." },
      { status: 500 },
    );
  }

  let rawText = "";
  try {
    const body = (await req.json()) as { rawText?: string };
    rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (rawText.length < 80) {
    return NextResponse.json({ error: "Provide more extracted text to infer metadata." }, { status: 400 });
  }

  const snippet = rawText.slice(0, 12_000);

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Lesson plan text:\n\n${snippet}\n\nReturn JSON only.`,
          },
        ],
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "DeepSeek request failed." },
      { status: 502 },
    );
  }

  const rawBody = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: deepSeekHttpErrorMessage(res.status, rawBody) }, { status: 502 });
  }

  const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
  if (!content?.trim()) {
    return NextResponse.json({ error: errorMessage ?? "Empty inference response." }, { status: 502 });
  }

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  // Per requirement: only JSON.parse when the payload looks like a JSON object.
  if (!looksLikeJsonObject(cleaned)) {
    return NextResponse.json({
      topic: "Topic (edit me)",
      subject: "Subject (edit me)",
      grade: "Grade (edit me)",
      learningObjectives: cleaned.slice(0, 300) || "Learning objectives (edit me)",
      parseNotice: "Model returned plain text instead of JSON. Raw text was used as a fallback.",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return NextResponse.json({
      topic: "Topic (edit me)",
      subject: "Subject (edit me)",
      grade: "Grade (edit me)",
      learningObjectives: cleaned.slice(0, 300) || "Learning objectives (edit me)",
      parseNotice: "JSON parsing failed. Falling back to raw model text.",
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({
      topic: "Topic (edit me)",
      subject: "Subject (edit me)",
      grade: "Grade (edit me)",
      learningObjectives: cleaned.slice(0, 300) || "Learning objectives (edit me)",
      parseNotice: "Model returned an unexpected JSON shape. Falling back to raw text.",
    });
  }

  const o = parsed as Record<string, unknown>;
  const topic = typeof o.topic === "string" ? o.topic.trim() : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const grade = typeof o.grade === "string" ? o.grade.trim() : "";
  const learningObjectives =
    typeof o.learningObjectives === "string" ? o.learningObjectives.trim() : "";

  return NextResponse.json({
    topic: topic || "Topic (edit me)",
    subject: subject || "Subject (edit me)",
    grade: grade || "Grade (edit me)",
    learningObjectives: learningObjectives || "Learning objectives (edit me)",
  });
}
