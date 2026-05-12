import { NextResponse } from "next/server";
import {
  buildCurriculumFrameworkSystemAddendum,
  getCurriculumFrameworkLabel,
  isValidCurriculumFramework,
} from "@/lib/curriculum-framework";
import { buildDeepseekLessonSystemPrompt } from "@/lib/deepseek-lesson-system-prompt";
import { generateFluxSectionImages, formatFalError } from "@/lib/fal-flux-section-images";
import {
  normalizeGenerationSections,
  SOURCE_MATERIAL_MAX_CHARS,
  TEACHER_PACKAGE_BLOCK_MARKERS,
  TEACHER_PACKAGE_SECTIONS,
  type LessonPlanGenerateBody,
  type LessonPlanInput,
  type LessonPlanResult,
  type SectionImageMap,
  type TeacherPackageSectionKey,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
} from "@/lib/lesson-plan";
import { formatAflForAiPrompt, sanitizeAflSelections } from "@/lib/afl-tools";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import {
  parseTeacherPackageResponse,
  stripOuterMarkdownFences,
} from "@/lib/parse-teacher-package-response";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (!isValidCurriculumFramework(input.curriculumFramework)) {
    return "Invalid curriculum framework selection.";
  }
  return null;
}

function buildMessages(
  input: LessonPlanInput,
  sections: readonly TeacherPackageSectionKey[],
  sourceMaterial: string | undefined,
  frameworkAddendum: string | null,
  aflPromptBlock: string,
): DeepSeekMessage[] {
  const sectionInstructions = sections
    .map((key) => {
      const [start, end] = TEACHER_PACKAGE_BLOCK_MARKERS[key];
      return `- **${key}**: wrap the entire section between these two lines (exactly as written, uppercase, on their own lines):\n  ${start}\n  …your content…\n  ${end}`;
    })
    .join("\n\n");

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

  const fw = input.curriculumFramework.trim();
  const frameworkUserLine =
    fw.length > 0
      ? `\n- **Curriculum framework (mandatory alignment):** ${getCurriculumFrameworkLabel(fw)} — apply the framework rules in the system prompt to every field you generate.`
      : "";

  const arabicBlock =
    input.subject.trim() === "Arabic"
      ? `

### Output language (mandatory)
Subject is **Arabic language teaching**. Write the **Full Lesson Plan**, **PPT Slide Content**, and every other requested section in **Modern Standard Arabic**, with the same teaching structure as the system prompt. Keep START/END marker lines exactly as specified (Latin, uppercase). Do not leave sections empty.`
      : "";

  return [
    {
      role: "system",
      content: buildDeepseekLessonSystemPrompt(sections, {
        curriculumFrameworkAddendum: frameworkAddendum,
        subject: input.subject.trim(),
      }),
    },
    {
      role: "user",
      content: `
Use this class context. Produce **only** the following teacher-package sections, each wrapped in its START/END marker lines as described (plain text — not JSON).

${sectionInstructions}

- Curriculum: ${input.curriculumType.trim()}
- Grade / Year group: ${input.grade.trim()}
- Subject: ${input.subject.trim()}
${chapterLine}
- Topic (within the chapter): ${input.topic.trim()}
- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}${frameworkUserLine}
${sourceBlock}
${aflPromptBlock}
${arabicBlock}

Follow every instructional design rule in the system prompt that applies to the outputs you are generating. Align examples, vocabulary, and progression to the curriculum and grade named above. Each requested section must be classroom-ready (not placeholders). **PPT Slide Content** must read as finished on-screen text for learners (no teacher coaching phrases in the slide body).
      `.trim(),
    },
  ];
}

function emptyLessonShell(sections: readonly TeacherPackageSectionKey[]): LessonPlanResult {
  const out: LessonPlanResult = {};
  for (const k of sections) out[k] = "";
  return out;
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
      { error: "DEEPSEEK_API_KEY appears invalid (too short). Please check your environment variable." },
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
    curriculumFramework:
      typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "",
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

  const frameworkAddendum = buildCurriculumFrameworkSystemAddendum(input.curriculumFramework);

  const aflSelections = sanitizeAflSelections(body.aflSelections);
  const aflFormatted = formatAflForAiPrompt(aflSelections);
  const aflPromptBlock = aflFormatted ? `\n\n${aflFormatted}` : "";

  const orderedSections = TEACHER_PACKAGE_SECTIONS.filter((k) => sections.includes(k));
  const mergedPlan = emptyLessonShell(sections);
  const parseNotices: string[] = [];

  for (const section of orderedSections) {
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
          temperature: 0.55,
          max_tokens: DEEPSEEK_MAX_TOKENS,
          messages: buildMessages(input, [section], sourceMaterial, frameworkAddendum, aflPromptBlock),
        }),
      });
    } catch (err) {
      console.error("[lesson-plan] DeepSeek fetch error:", section, err);
      mergedPlan[section] = `_(This section could not be generated: network or server error.)_\n\n${String(
        err instanceof Error ? err.message : err,
      )}`.slice(0, 12_000);
      parseNotices.push(`${section}: request failed before a response was received.`);
      continue;
    }

    const rawBody = await deepseekResponse.text();
    logDeepSeekRawResponse(`lesson-plan:${section}`, deepseekResponse, rawBody);
    if (!deepseekResponse.ok) {
      console.warn(
        "[lesson-plan] DeepSeek HTTP error:",
        section,
        deepseekResponse.status,
        rawBody.slice(0, 400),
      );
      const friendly = deepSeekHttpErrorMessage(deepseekResponse.status, rawBody);
      mergedPlan[section] = `_(DeepSeek failed for this section.)_\n\n${friendly}`;
      parseNotices.push(`${section}: ${friendly}`);
      continue;
    }

    const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
    if (errorMessage) {
      parseNotices.push(`${section}: ${errorMessage}`);
    }
    if (!content?.trim()) {
      mergedPlan[section] = `(No usable text was returned for **${section}**.)${errorMessage ? `\n\n${errorMessage}` : ""}`;
      continue;
    }

    console.log(`[lesson-plan] DeepSeek raw response (${section}):\n`, content);

    const { plan: slicePlan, parseNotice: sliceNotice, mode } = parseTeacherPackageResponse(content, [
      section,
    ]);
    console.log("[lesson-plan] Parsed teacher package mode:", section, mode);

    let body = (slicePlan[section] ?? "").trim();
    if (!body && content.trim()) {
      body = stripOuterMarkdownFences(content.trim());
      parseNotices.push(`${section}: Plain-text fallback used (markers not detected).`);
    }
    mergedPlan[section] = body || `(Empty after parsing for **${section}**.)`;
    if (sliceNotice) parseNotices.push(`${section}: ${sliceNotice}`);
  }

  const parseNotice = parseNotices.length > 0 ? parseNotices.join("\n\n") : undefined;

  let sectionImages: SectionImageMap = {};
  let sectionImageErrors: Partial<Record<TeacherPackageSectionKey, string>> = {};
  try {
    const fluxResult = await generateFluxSectionImages({
      input,
      plan: mergedPlan,
      sections,
    });
    sectionImages = fluxResult.sectionImages;
    sectionImageErrors = fluxResult.errors;
    if (Object.keys(sectionImageErrors).length > 0) {
      console.warn("[lesson-plan] section image errors:", sectionImageErrors);
    }
  } catch (e) {
    console.error("[lesson-plan] FLUX section images failed:", formatFalError(e), e);
  }

  return NextResponse.json({
    lessonPlan: mergedPlan,
    ...(parseNotice ? { parseNotice } : {}),
    ...(Object.keys(sectionImages).length > 0 ? { sectionImages } : {}),
    ...(Object.keys(sectionImageErrors).length > 0 ? { sectionImageErrors } : {}),
  });
}
