import { NextResponse } from "next/server";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM = `You read lesson plan text and return ONLY valid JSON (no markdown fences) with keys:
topic (string), subject (string), grade (string), learningObjectives (string).
Infer sensible values from headings and body if labels are missing. Use English. Grade examples: "Grade 7", "Year 9".`;

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing DEEPSEEK_API_KEY." }, { status: 500 });
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
    return NextResponse.json({ error: rawBody.slice(0, 500) }, { status: 502 });
  }

  const { content } = parseDeepSeekCompletionBody(rawBody);
  if (!content?.trim()) {
    return NextResponse.json({ error: "Empty inference response." }, { status: 502 });
  }

  let parsed: unknown;
  try {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return NextResponse.json({ error: "Model did not return valid JSON." }, { status: 502 });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Invalid JSON shape." }, { status: 502 });
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
