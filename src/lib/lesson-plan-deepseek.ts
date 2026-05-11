import { getCurriculumFrameworkLabel } from "@/lib/curriculum-framework";
import { buildDeepseekLessonSystemPrompt } from "@/lib/deepseek-lesson-system-prompt";
import type { LessonPlanInput, TeacherPackageSectionKey } from "@/lib/lesson-plan";
import { SOURCE_MATERIAL_MAX_CHARS } from "@/lib/lesson-plan";

export const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/chat/completions";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function extractJsonObject(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

export function parseSingleSectionFromResponse(
  content: string,
  section: TeacherPackageSectionKey,
): string | null {
  const jsonCandidate = extractJsonObject(content);
  if (!jsonCandidate) return null;
  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
    const value = parsed[section];
    if (typeof value === "string") {
      return value.trim().length > 0 ? value.trim() : null;
    }
    if (value === null || value === undefined) return null;
    try {
      const asJson = JSON.stringify(value, null, 2);
      return asJson && asJson.trim().length > 0 ? asJson : null;
    } catch {
      const asText = String(value);
      return asText.trim().length > 0 ? asText : null;
    }
  } catch {
    // Fallback: try to regex-extract a JSON string value for this key.
    // This helps when the model output is "almost JSON" (e.g. invalid escapes) but still contains the key.
    try {
      const escapedKey = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\"${escapedKey}\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\")`);
      const m = jsonCandidate.match(re);
      const rawStringLiteral = m?.[1];
      if (rawStringLiteral) {
        const decoded = JSON.parse(rawStringLiteral) as unknown;
        if (typeof decoded === "string" && decoded.trim().length > 0) {
          return decoded.trim();
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export function buildMessagesForSingleSection(
  input: LessonPlanInput,
  section: TeacherPackageSectionKey,
  sourceMaterial: string | undefined,
  frameworkAddendum: string | null,
): DeepSeekMessage[] {
  const sections: readonly TeacherPackageSectionKey[] = [section];
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
Use the following extracted text as the main factual and instructional basis for the section you generate. Ground examples, definitions, sequencing, and practice tasks in this material while still honoring the curriculum, grade, topic, and learning objectives below. If the source is partial, infer sensible teaching structure and label reasonable inferences clearly.

${trimmedSource.slice(0, SOURCE_MATERIAL_MAX_CHARS)}
`
      : "";

  const fw = input.curriculumFramework.trim();
  const frameworkUserLine =
    fw.length > 0
      ? `\n- **Curriculum framework (mandatory alignment):** ${getCurriculumFrameworkLabel(fw)} — apply the framework rules in the system prompt to every field you generate.`
      : "";

  return [
    {
      role: "system",
      content: buildDeepseekLessonSystemPrompt(sections, {
        curriculumFrameworkAddendum: frameworkAddendum,
      }),
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
- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}${frameworkUserLine}
${sourceBlock}

Follow every instructional design rule in the system prompt that applies to this output. Align examples, vocabulary, and progression to the curriculum and grade named above. The requested field must be classroom-ready (not a placeholder).
      `.trim(),
    },
  ];
}

export async function callDeepseekChat(
  apiKey: string,
  messages: DeepSeekMessage[],
): Promise<string> {
  const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.55,
      messages,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DeepSeek request failed: ${errorText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned an empty response.");
  }
  return content;
}
