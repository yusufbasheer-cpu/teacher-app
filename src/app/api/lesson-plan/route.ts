import { NextResponse } from "next/server";
import { buildDeepseekLessonSystemPrompt } from "@/lib/deepseek-lesson-system-prompt";
import {
  normalizeGenerationSections,
  type LessonPlanGenerateBody,
  type LessonPlanInput,
  type LessonPlanResult,
  type TeacherPackageSectionKey,
} from "@/lib/lesson-plan";

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

function parsePlan(
  content: string,
  sections: readonly TeacherPackageSectionKey[],
): LessonPlanResult | null {
  const jsonCandidate = extractJsonObject(content);
  if (!jsonCandidate) return null;

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
    const result: LessonPlanResult = {};

    for (const section of sections) {
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

function buildMessages(input: LessonPlanInput, sections: readonly TeacherPackageSectionKey[]): DeepSeekMessage[] {
  const keysList = sections.map((k) => JSON.stringify(k)).join(", ");
  return [
    {
      role: "system",
      content: buildDeepseekLessonSystemPrompt(sections),
    },
    {
      role: "user",
      content: `
Use this class context. Produce ONLY these JSON fields (no others): ${keysList}

- Subject: ${input.subject}
- Grade / Year group: ${input.grade}
- Topic: ${input.topic}
- Teacher-provided learning objectives / focus: ${input.learningObjectives}

Follow every instructional design rule in the system prompt that applies to the outputs you are generating. Adapt tone and examples to the subject and grade. Each requested field must be classroom-ready (not placeholders).
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

  let body: LessonPlanGenerateBody;
  try {
    body = (await req.json()) as LessonPlanGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sections = normalizeGenerationSections(body.sections);
  if (!sections) {
    return NextResponse.json(
      { error: "Provide a non-empty \"sections\" array of valid teacher-package keys." },
      { status: 400 },
    );
  }

  const input: LessonPlanInput = {
    subject: body.subject ?? "",
    grade: body.grade ?? "",
    topic: body.topic ?? "",
    learningObjectives: body.learningObjectives ?? "",
  };

  if (!validateInput(input)) {
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
      messages: buildMessages(input, sections),
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

  const parsedPlan = parsePlan(content, sections);
  if (!parsedPlan) {
    return NextResponse.json(
      { error: "Could not parse structured teacher package from DeepSeek response." },
      { status: 502 },
    );
  }

  return NextResponse.json({ lessonPlan: parsedPlan });
}
