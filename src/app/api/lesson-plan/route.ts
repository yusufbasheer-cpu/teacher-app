import { NextResponse } from "next/server";
import { DEEPSEEK_LESSON_SYSTEM_PROMPT } from "@/lib/deepseek-lesson-system-prompt";
import { TEACHER_PACKAGE_SECTIONS } from "@/lib/lesson-plan";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/lesson-plan";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function validateInput(input: LessonPlanInput) {
  return (
    input.subject.trim().length > 0 &&
    input.grade.trim().length > 0 &&
    input.topic.trim().length > 0 &&
    input.learningObjectives.trim().length > 0
  );
}

function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

function parsePlan(content: string): LessonPlanResult | null {
  const jsonCandidate = extractJsonObject(content);
  if (!jsonCandidate) return null;

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
    const result: LessonPlanResult = {};

    for (const section of TEACHER_PACKAGE_SECTIONS) {
      const value = parsed[section];
      if (typeof value !== "string" || value.trim().length === 0) {
        return null;
      }
      result[section] = value.trim();
    }

    return result;
  } catch {
    return null;
  }
}

function buildMessages(input: LessonPlanInput): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: DEEPSEEK_LESSON_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `
Use this class context to build the complete teacher package (all six JSON fields):

- Subject: ${input.subject}
- Grade / Year group: ${input.grade}
- Topic: ${input.topic}
- Teacher-provided learning objectives / focus: ${input.learningObjectives}

Follow every instructional design rule in the system prompt. Adapt tone and examples to the subject and grade. Ensure "Full Lesson Plan" is comprehensive and the other five fields contain ready-to-use classroom materials (not placeholders).
      `.trim(),
    },
  ];
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing DEEPSEEK_API_KEY in environment variables." },
      { status: 500 },
    );
  }

  let body: LessonPlanInput;
  try {
    body = (await req.json()) as LessonPlanInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!validateInput(body)) {
    return NextResponse.json(
      { error: "Please fill Subject, Grade, Topic, and Learning Objectives." },
      { status: 400 },
    );
  }

  const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.55,
      messages: buildMessages(body),
    }),
  });

  if (!deepseekResponse.ok) {
    const errorText = await deepseekResponse.text();
    return NextResponse.json(
      { error: `DeepSeek request failed: ${errorText}` },
      { status: 502 },
    );
  }

  const data = (await deepseekResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "DeepSeek returned an empty response." },
      { status: 502 },
    );
  }

  const parsedPlan = parsePlan(content);
  if (!parsedPlan) {
    return NextResponse.json(
      { error: "Could not parse structured teacher package from DeepSeek response." },
      { status: 502 },
    );
  }

  return NextResponse.json({ lessonPlan: parsedPlan });
}
