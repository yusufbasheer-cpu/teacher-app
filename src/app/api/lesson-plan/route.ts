import { NextResponse } from "next/server";
import { buildDeepseekLessonSystemPrompt } from "@/lib/deepseek-lesson-system-prompt";
import {
  normalizeGenerationSections,
  SOURCE_MATERIAL_MAX_CHARS,
  type LessonPlanGenerateBody,
  type LessonPlanInput,
  type LessonPlanResult,
  type TeacherPackageSectionKey,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
} from "@/lib/lesson-plan";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function validateInput(input: LessonPlanInput): string | null {
  if (!isValidCurriculumType(input.curriculumType.trim())) {
    return "Invalid curriculum type.";
  }
  if (!isValidGradeYear(input.grade.trim())) {
    return "Invalid grade / year group.";
  }
  if (!isValidSubjectOption(input.subject.trim())) {
    return "Invalid subject.";
  }
  if (input.topic.trim().length === 0) {
    return "Please enter a topic.";
  }
  if (input.learningObjectives.trim().length === 0) {
    return "Please fill Learning Objectives.";
  }
  return null;
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

function buildMessages(
  input: LessonPlanInput,
  sections: readonly TeacherPackageSectionKey[],
  sourceMaterial?: string,
): DeepSeekMessage[] {
  const keysList = sections.map((k) => JSON.stringify(k)).join(", ");
  const chapterLine =
    input.chapter.trim().length > 0
      ? `- Chapter / unit: ${input.chapter.trim()}`
      : `- Chapter / unit: (not specified — infer sensible scope from topic and grade if needed)`;

  const trimmedSource = sourceMaterial?.trim();
  const sourceBlock =
    trimmedSource && trimmedSource.length > 0
      ? `

### Source material (from teacher-uploaded file(s): PDF and/or images — primary content basis)
Use the following extracted text as the main factual and instructional basis for every section you generate. Ground examples, definitions, sequencing, and practice tasks in this material while still honoring the curriculum, grade, topic, and learning objectives below. If the source is partial, infer sensible teaching structure and label reasonable inferences clearly.

${trimmedSource.slice(0, SOURCE_MATERIAL_MAX_CHARS)}
`
      : "";

  return [
    {
      role: "system",
      content: buildDeepseekLessonSystemPrompt(sections),
    },
    {
      role: "user",
      content: `
Use this class context. Produce ONLY these JSON fields (no others): ${keysList}

- Curriculum: ${input.curriculumType.trim()}
- Grade / Year group: ${input.grade.trim()}
- Subject: ${input.subject.trim()}
${chapterLine}
- Topic (within the chapter): ${input.topic.trim()}
- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}
${sourceBlock}

Follow every instructional design rule in the system prompt that applies to the outputs you are generating. Align examples, vocabulary, and progression to the curriculum and grade named above. Each requested field must be classroom-ready (not placeholders).
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
    curriculumType: body.curriculumType ?? "",
    grade: body.grade ?? "",
    subject: body.subject ?? "",
    chapter: typeof body.chapter === "string" ? body.chapter : "",
    topic: body.topic ?? "",
    learningObjectives: body.learningObjectives ?? "",
  };

  const rawSource =
    typeof body.sourceMaterial === "string" ? body.sourceMaterial.trim() : "";
  const sourceMaterial =
    rawSource.length > 0 ? rawSource.slice(0, SOURCE_MATERIAL_MAX_CHARS) : undefined;

  const validationError = validateInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
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
      messages: buildMessages(input, sections, sourceMaterial),
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
