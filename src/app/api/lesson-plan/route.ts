import { NextResponse } from "next/server";
import {
  assertCanGenerate,
  authenticateRequest,
  recordSuccessfulGeneration,
} from "@/lib/user-usage-server";
import {
  checkRateLimit,
  checkSpendingProtection,
  getClientIp,
  rateLimitResponse,
  HOUR_MS,
  DAY_MS,
} from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";
import {
  buildCurriculumFrameworkSystemAddendum,
  getCurriculumFrameworkLabel,
  isUaeCurriculumFramework,
  isValidCurriculumFramework,
} from "@/lib/curriculum-framework";
import {
  buildDeepseekLessonSystemPrompt,
  buildSinglePptSlideDeepseekSystemPrompt,
} from "@/lib/deepseek-lesson-system-prompt";
import { generateFluxSectionImages, formatFalError } from "@/lib/fal-flux-section-images";
import { apiErrorResponse } from "@/lib/api-client-error";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { SECTION_GENERATION_FAILED, USER_FACING_ERROR } from "@/lib/user-facing-errors";
import {
  normalizeGenerationSections,
  SOURCE_MATERIAL_MAX_CHARS,
  TEACHER_PACKAGE_BLOCK_MARKERS,
  TEACHER_PACKAGE_SECTIONS,
  buildGenerationSourceMaterial,
  buildSourceMaterialPromptBlock,
  isLanguageTeachingSubject,
  mergePptSlideImageUrlsIntoPlan,
  usesArabicPptSlideTitles,
  type LessonPlanGenerateBody,
  type LessonPlanInput,
  type LessonPlanResult,
  type SectionImageMap,
  type TeacherPackageSectionKey,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
} from "@/lib/lesson-plan";
import {
  formatAflForAiPrompt,
  formatAflForSinglePptSlidePrompt,
  sanitizeAflSelections,
  buildAflActivitySheetsUserMessage,
} from "@/lib/afl-tools";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import {
  parseTeacherPackageResponse,
  stripOuterMarkdownFences,
} from "@/lib/parse-teacher-package-response";
import {
  assembleFullPptFromSlideBodies,
  buildProgrammaticSlide1Body,
  buildSinglePptSlideUserMessage,
  buildTeacherObjectivesSlide4Body,
  countTeacherObjectiveLines,
  parseDeckBodiesFromPptOutline,
  parseSinglePptSlideModelResponse,
  slide5OutcomesAlignWithTeacherObjectives,
  slideBodyPassesQualityGate,
  type EarlySlideSanitizeContext,
} from "@/lib/ppt-slide-by-slide";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { generatePptDeckSlideImages } from "@/lib/ppt-image-resolver";
import {
  buildPptSlidePreflightChecklist,
  buildSlide8PptModeBlock,
  sanitizePptSlideBody,
  validatePptSlideBody,
} from "@/lib/ppt-slide-validation";

export const runtime = "nodejs";
/** Thirteen sequential slide calls plus other sections may exceed the default 60s cap. */
export const maxDuration = 300;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MAX_TOKENS = 8000;
const DEEPSEEK_MAX_TOKENS_PPT_SLIDE = 2400;
const PPT_SLIDE_MAX_ATTEMPTS = 3;

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

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
      ? buildSourceMaterialPromptBlock(trimmedSource)
      : "";

  const fw = input.curriculumFramework.trim();
  const frameworkUserLine =
    fw.length > 0
      ? `\n- **Curriculum framework (mandatory alignment):** ${getCurriculumFrameworkLabel(fw)} — apply the framework rules in the system prompt to every field you generate.`
      : "";

  const languageUserBlock = buildLanguageSubjectUserBlock(input.subject.trim());

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
${languageUserBlock}

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

function frameworkUserLineForPpt(input: LessonPlanInput): string {
  const fw = input.curriculumFramework.trim();
  if (fw.length === 0) return "";
  return `\n- **Curriculum framework (mandatory alignment):** ${getCurriculumFrameworkLabel(fw)} — apply the framework rules in the system prompt to every field you generate.`;
}

function buildLanguageSubjectUserBlock(subject: string): string {
  if (!isLanguageTeachingSubject(subject)) return "";
  if (subject === "Arabic") {
    return `

### Output language (mandatory)
Subject is **Arabic language teaching**. Write the **Full Lesson Plan**, **PPT Slide Content**, and every other requested section in **Modern Standard Arabic**, with the same teaching structure as the system prompt. Keep START/END marker lines exactly as specified (Latin, uppercase). Do not leave sections empty.`;
  }
  return `

### Output language (mandatory)
Subject is **${subject} language teaching**. Write every requested section **substantially in ${subject}**, appropriate for the grade. Keep START/END marker lines exactly as specified (Latin, uppercase). Do not leave sections empty.`;
}

function arabicSlideExtraBlock(input: LessonPlanInput): string {
  if (!usesArabicPptSlideTitles(input.subject.trim())) {
    if (isLanguageTeachingSubject(input.subject.trim())) {
      const subj = input.subject.trim();
      return `### Output language (mandatory)
Subject is **${subj} language teaching**. Write **this slide body** substantially in **${subj}** for learners.`;
    }
    return "";
  }
  return `### Output language (mandatory)
Subject is **Arabic language teaching**. Write **this slide body** in **Modern Standard Arabic** for learners.`;
}

async function generatePptSlideContentSlideBySlide(params: {
  apiKey: string;
  input: LessonPlanInput;
  sourceMaterial: string | undefined;
  frameworkAddendum: string | null;
  aflSelections: ReturnType<typeof sanitizeAflSelections>;
  fullLessonPlan: string;
  onProgress: (message: string) => void;
}): Promise<{ text: string; notices: string[] }> {
  const { apiKey, input, sourceMaterial, frameworkAddendum, aflSelections, fullLessonPlan, onProgress } =
    params;
  const notices: string[] = [];
  const bodies: string[] = [];
  const isAr = usesArabicPptSlideTitles(input.subject.trim());
  const uaeFrameworkSelected = isUaeCurriculumFramework(input.curriculumFramework);
  const slide8ModeBlock = buildSlide8PptModeBlock(uaeFrameworkSelected);
  console.log(
    `[ppt-deck] slide-8 mode: ${uaeFrameworkSelected ? "UAE Framework (inspection-ready UAE connection)" : "global connection (no UAE)"}`,
  );
  const fwLine = frameworkUserLineForPpt(input);
  const arabicExtra = arabicSlideExtraBlock(input);
  const locale = isAr ? "ar-AE" : "en-GB";
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const earlyCtx: EarlySlideSanitizeContext = {
    subject: input.subject.trim(),
    grade: input.grade.trim(),
    topic: input.topic.trim(),
    chapter: input.chapter.trim(),
    dateStr,
    teacherObjectives: input.learningObjectives.trim(),
    isAr,
  };

  for (let slide = 1; slide <= STRUCTURED_LESSON_DECK_SLIDE_COUNT; slide++) {
    onProgress(`Generating Slide ${slide} of ${STRUCTURED_LESSON_DECK_SLIDE_COUNT}`);

    if (slide === 1) {
      bodies.push(buildProgrammaticSlide1Body(input.grade.trim(), dateStr));
      continue;
    }

    if (slide === 4) {
      bodies.push(buildTeacherObjectivesSlide4Body(input.learningObjectives));
      continue;
    }

    const aflForSlide = formatAflForSinglePptSlidePrompt(slide, aflSelections, {
      subject: input.subject.trim(),
      grade: input.grade.trim(),
      topic: input.topic.trim(),
      learningObjectives: input.learningObjectives.trim(),
    });
    const validationCtx = {
      slideNumber1Based: slide,
      isAr,
      uaeFrameworkSelected,
      subject: input.subject.trim(),
      topic: input.topic.trim(),
      teacherObjectives: input.learningObjectives.trim(),
    };
    const preflightChecklist = buildPptSlidePreflightChecklist(validationCtx);
    let chosen = "";
    let lastHttpError: string | null = null;

    for (let attempt = 1; attempt <= PPT_SLIDE_MAX_ATTEMPTS; attempt++) {
      const messages: DeepSeekMessage[] = [
        {
          role: "system",
          content: buildSinglePptSlideDeepseekSystemPrompt(slide, {
            curriculumFrameworkAddendum: frameworkAddendum,
            subject: input.subject.trim(),
            uaeFrameworkSelected,
          }),
        },
        {
          role: "user",
          content: buildSinglePptSlideUserMessage({
            slideNumber1Based: slide,
            input,
            sourceMaterial,
            frameworkUserLine: `${fwLine}${slide === 8 || attempt === 1 ? `\n\n${slide8ModeBlock}` : ""}`,
            fullLessonPlan,
            arabicExtraBlock: arabicExtra,
            aflForThisSlide: aflForSlide,
            uaeFrameworkSelected,
            preflightChecklist,
            regenerateHint:
              attempt > 1
                ? slide === 5
                  ? `Regenerate: write exactly ${countTeacherObjectiveLines(input.learningObjectives)} outcome(s) in the same order as the teacher objectives — one outcome per objective, no extras.`
                  : slide === 7
                    ? 'Regenerate: exactly three sections only — "Higher Achievers task", "Middle Achievers task", "Lower Achievers task" — each with a full task. No Quick Check, Mini Plenary, plenary, homework, or success criteria.'
                    : slide === 10
                      ? "Regenerate: extended task or homework only. Do not repeat the slide title. Remove all success criteria, self-evaluation, and exit ticket content."
                    : slide === 8
                    ? uaeFrameworkSelected
                      ? "Regenerate: include UAE-specific landmarks/values, MOE alignment, KHDA/SPEA, national identity, and SDG in UAE context. Do not repeat the slide title in the body."
                      : "Regenerate: choose ONE non-UAE link only. Remove every UAE/Emirates/Dubai/MOE/KHDA/SPEA reference."
                    : "Regenerate: previous attempt was too short, missing markers, or failed validation. Produce a fuller on-brief slide body for THIS slide only; keep strict isolation."
                : undefined,
          }),
        },
      ];

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
            max_tokens: DEEPSEEK_MAX_TOKENS_PPT_SLIDE,
            messages,
          }),
        });
      } catch (err) {
        lastHttpError = String(err instanceof Error ? err.message : err);
        notices.push(`PPT Slide Content slide ${slide} attempt ${attempt}: network error — ${lastHttpError}`);
        continue;
      }

      const rawBody = await deepseekResponse.text();
      logDeepSeekRawResponse(
        `lesson-plan:PPT-slide-${slide}-a${attempt}`,
        deepseekResponse,
        rawBody,
      );

      if (!deepseekResponse.ok) {
        lastHttpError = deepSeekHttpErrorMessage(deepseekResponse.status, rawBody);
        notices.push(`PPT Slide Content slide ${slide} attempt ${attempt}: ${lastHttpError}`);
        continue;
      }

      const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
      if (errorMessage) {
        notices.push(`PPT Slide Content slide ${slide} attempt ${attempt}: ${errorMessage}`);
      }
      const parsed = parseSinglePptSlideModelResponse(content ?? "");
      chosen = parsed.trim();
      if (!chosen && (content ?? "").trim()) {
        chosen = stripOuterMarkdownFences((content ?? "").trim());
        notices.push(`PPT Slide Content slide ${slide} attempt ${attempt}: marker fallback used.`);
      }
      if (slide !== 1 && slide !== 4) {
        chosen = sanitizePptSlideBody(slide, chosen, { ...earlyCtx, uaeFrameworkSelected });
      }
      if (slide === 5) {
        if (
          slideBodyPassesQualityGate(slide, chosen) &&
          slide5OutcomesAlignWithTeacherObjectives(chosen, input.learningObjectives, isAr)
        ) {
          const v = validatePptSlideBody(chosen, validationCtx);
          if (v.ok) break;
          notices.push(
            `PPT Slide Content slide ${slide} attempt ${attempt}: structure validation — ${v.reasons.join("; ")}`,
          );
          continue;
        }
        notices.push(
          `PPT Slide Content slide ${slide} attempt ${attempt}: outcomes must match teacher objectives (exact count and order).`,
        );
        continue;
      }
      const structureOk = validatePptSlideBody(chosen, validationCtx);
      if (slideBodyPassesQualityGate(slide, chosen) && structureOk.ok) {
        break;
      }
      if (!structureOk.ok) {
        notices.push(
          `PPT Slide Content slide ${slide} attempt ${attempt}: structure validation — ${structureOk.reasons.join("; ")}`,
        );
      } else {
        notices.push(
          `PPT Slide Content slide ${slide} attempt ${attempt}: quality gate not satisfied (length or empty).`,
        );
      }
    }

    if (!chosen.trim()) {
      chosen = `_(This slide could not be generated after ${PPT_SLIDE_MAX_ATTEMPTS} attempts.)_${lastHttpError ? `\n\n${lastHttpError}` : ""}`;
    } else if (slide === 1 || slide === 4) {
      chosen = sanitizePptSlideBody(slide, chosen, { ...earlyCtx, uaeFrameworkSelected });
    }
    bodies.push(chosen.trim());
  }

  return {
    text: assembleFullPptFromSlideBodies(bodies, isAr, uaeFrameworkSelected),
    notices,
  };
}

type GeneratePackageParams = {
  apiKey: string;
  input: LessonPlanInput;
  sections: readonly TeacherPackageSectionKey[];
  sourceMaterial: string | undefined;
  frameworkAddendum: string | null;
  aflSelections: ReturnType<typeof sanitizeAflSelections>;
  aflPromptBlock: string;
  onProgress?: (message: string) => void;
};

async function generateTeacherPackage(params: GeneratePackageParams): Promise<{
  mergedPlan: LessonPlanResult;
  parseNotices: string[];
}> {
  const { apiKey, input, sections, sourceMaterial, frameworkAddendum, aflSelections, aflPromptBlock, onProgress } =
    params;
  const orderedSections = TEACHER_PACKAGE_SECTIONS.filter((k) => sections.includes(k));
  const mergedPlan = emptyLessonShell(sections);
  const parseNotices: string[] = [];

  for (const section of orderedSections) {
    if (section === "PPT Slide Content") {
      const fullLesson = (mergedPlan["Full Lesson Plan"] ?? "").trim();
      const { text, notices } = await generatePptSlideContentSlideBySlide({
        apiKey,
        input,
        sourceMaterial,
        frameworkAddendum,
        aflSelections,
        fullLessonPlan: fullLesson,
        onProgress: onProgress ?? (() => {}),
      });
      mergedPlan[section] = text;
      for (const n of notices) parseNotices.push(n);
      continue;
    }

    if (section === "AFL Activity Sheets") {
      onProgress?.("Generating AFL Activity Sheets");
      const sourceMaterialBlock = sourceMaterial
        ? `### Source material\n${sourceMaterial.slice(0, 6_000)}`
        : undefined;
      const userMsg = buildAflActivitySheetsUserMessage({
        input: {
          subject: input.subject,
          grade: input.grade,
          topic: input.topic,
          chapter: input.chapter,
          curriculumType: input.curriculumType,
        },
        selections: aflSelections,
        sourceMaterialBlock,
      });
      if (!userMsg) {
        mergedPlan[section] =
          "(No AFL tools were selected — AFL Activity Sheets are generated only when AFL tools are chosen in the generator.)";
        continue;
      }
      let aflSheetResponse: Response;
      try {
        aflSheetResponse = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            temperature: 0.5,
            max_tokens: DEEPSEEK_MAX_TOKENS,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert teacher generating printable student-facing activity sheets. Generate rich, complete, classroom-ready content specific to the topic, subject, and grade. Use plain text only — no markdown code fences. Wrap all output between the exact markers shown in the user message.",
              },
              { role: "user", content: userMsg },
            ],
          }),
        });
      } catch (err) {
        console.error("[lesson-plan] AFL Activity Sheets fetch error:", err);
        mergedPlan[section] = SECTION_GENERATION_FAILED;
        continue;
      }
      const rawAflBody = await aflSheetResponse.text();
      logDeepSeekRawResponse("lesson-plan:AFL-Activity-Sheets", aflSheetResponse, rawAflBody);
      if (!aflSheetResponse.ok) {
        console.warn(
          "[lesson-plan] AFL Activity Sheets HTTP error:",
          aflSheetResponse.status,
          deepSeekHttpErrorMessage(aflSheetResponse.status, rawAflBody),
        );
        mergedPlan[section] = SECTION_GENERATION_FAILED;
        continue;
      }
      const { content: aflContent } = parseDeepSeekCompletionBody(rawAflBody);
      if (!aflContent?.trim()) {
        mergedPlan[section] = "(No content returned for AFL Activity Sheets.)";
        continue;
      }
      const { plan: aflPlan } = parseTeacherPackageResponse(aflContent, ["AFL Activity Sheets"]);
      const extracted = aflPlan["AFL Activity Sheets"] ?? aflContent;
      mergedPlan[section] = extracted.trim();
      continue;
    }

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
      mergedPlan[section] = SECTION_GENERATION_FAILED;
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
      console.warn(
        "[lesson-plan] section HTTP error:",
        section,
        deepSeekHttpErrorMessage(deepseekResponse.status, rawBody),
      );
      mergedPlan[section] = SECTION_GENERATION_FAILED;
      continue;
    }

    const { content, errorMessage } = parseDeepSeekCompletionBody(rawBody);
    if (errorMessage) {
      console.warn(`[lesson-plan] parse notice for ${section}:`, errorMessage);
    }
    if (!content?.trim()) {
      mergedPlan[section] = SECTION_GENERATION_FAILED;
      continue;
    }

    console.log(`[lesson-plan] section generated: ${section} (${content.length} chars)`);

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

  return { mergedPlan, parseNotices };
}

async function runFluxAndBuildResponsePayload(
  input: LessonPlanInput,
  sections: readonly TeacherPackageSectionKey[],
  mergedPlan: LessonPlanResult,
  parseNotices: string[],
): Promise<{
  lessonPlan: LessonPlanResult;
  parseNotice?: string;
  sectionImages?: SectionImageMap;
  pptSlideImageUrls?: (string | null)[];
}> {
  let workingPlan = mergedPlan;
  let pptSlideImageUrls: (string | null)[] | undefined;
  const imageNotices: string[] = [];

  if (sections.includes("PPT Slide Content")) {
    try {
      const { urls, notices: imgNotices } = await generatePptDeckSlideImages({
        topic: input.topic.trim(),
        subject: input.subject.trim(),
        grade: input.grade.trim(),
        curriculumFramework: input.curriculumFramework.trim() || undefined,
      });
      workingPlan = mergePptSlideImageUrlsIntoPlan(workingPlan, urls);
      pptSlideImageUrls = urls;
      imageNotices.push(...imgNotices);
      const pexelsFilled = [0, 1, 7, 8, 9].filter((i) => Boolean(urls[i])).length;
      console.log(
        "[lesson-plan] PPT deck images attached:",
        urls.filter(Boolean).length,
        "total URLs;",
        "Pexels slides 1,2,8,9,10:",
        pexelsFilled,
        "/5",
      );
      console.log(
        "[lesson-plan] pptSlideImageUrls passed to client:",
        JSON.stringify(
          [0, 1, 7, 8, 9].map((i) => ({
            slide: i + 1,
            hasUrl: Boolean(urls[i]),
          })),
        ),
      );
    } catch (e) {
      const msg = formatFalError(e);
      imageNotices.push(`PPT image generation failed: ${msg}`);
      console.error("[lesson-plan] PPT deck image generation failed:", msg, e);
    }
  }

  let sectionImages: SectionImageMap = {};
  try {
    const fluxResult = await generateFluxSectionImages({
      input,
      plan: workingPlan,
      sections,
    });
    sectionImages = fluxResult.sectionImages;
    if (Object.keys(fluxResult.errors).length > 0) {
      console.warn("[lesson-plan] section image errors (not shown to user):", fluxResult.errors);
    }
  } catch (e) {
    console.error("[lesson-plan] FLUX section images failed:", formatFalError(e), e);
  }

  const parseNoticeParts = filterUserFacingNotices([...parseNotices, ...imageNotices]);
  const parseNotice = parseNoticeParts.length > 0 ? parseNoticeParts.join("\n\n") : undefined;

  return {
    lessonPlan: workingPlan,
    ...(parseNotice ? { parseNotice } : {}),
    ...(Object.keys(sectionImages).length > 0 ? { sectionImages } : {}),
    ...(pptSlideImageUrls ? { pptSlideImageUrls } : {}),
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return apiErrorResponse("Missing DEEPSEEK_API_KEY", 500, "lesson-plan");
  }
  if (apiKey.length < 12) {
    return apiErrorResponse("DEEPSEEK_API_KEY too short", 500, "lesson-plan");
  }

  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`lesson-plan:ip:${ip}`, 10, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

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
  const rawPasted =
    typeof body.pastedContent === "string" ? body.pastedContent.trim() : "";
  const sourceMaterial = buildGenerationSourceMaterial({
    pastedContent: rawPasted.slice(0, SOURCE_MATERIAL_MAX_CHARS),
    uploadedExtractedText: rawSource.slice(0, SOURCE_MATERIAL_MAX_CHARS),
  });

  const validationError = validateInput(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const userDayLimit = checkRateLimit(`lesson-plan:user:${auth.userId}`, 30, DAY_MS);
  if (!userDayLimit.ok) return rateLimitResponse(userDayLimit.resetInSeconds);

  const spending = checkSpendingProtection(auth.userId);
  if (spending.blocked) {
    if (spending.shouldAlert) {
      void sendEmail({
        to: "info@layah.in",
        subject: "Layah Spending Alert — User Blocked",
        text: `User ${auth.userId} exceeded 50 API calls in one hour and has been automatically blocked.\n\nEndpoint: /api/lesson-plan\nTime: ${new Date().toISOString()}`,
      });
    }
    return rateLimitResponse(spending.resetInSeconds);
  }

  const gate = await assertCanGenerate(auth.supabase, auth.userId);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: gate.message,
        code: gate.code,
        usage: gate.usage,
        upgradePitch: {
          headline: gate.message,
          subline:
            gate.usage.planType === "free"
              ? "Upgrade to Pro for 30 generations per month for just 15 AED."
              : "Upgrade your plan for more generations this month.",
        },
      },
      { status: gate.status },
    );
  }

  const frameworkAddendum = buildCurriculumFrameworkSystemAddendum(input.curriculumFramework);

  const aflSelections = sanitizeAflSelections(body.aflSelections);
  const aflCtx = {
    subject: input.subject.trim(),
    grade: input.grade.trim(),
    topic: input.topic.trim(),
    learningObjectives: input.learningObjectives.trim(),
  };
  const aflFormatted = formatAflForAiPrompt(aflSelections, aflCtx);
  const aflPromptBlock = aflFormatted ? `\n\n${aflFormatted}` : "";

  const wantsNdjsonStream =
    Boolean(body.streamProgress) && sections.includes("PPT Slide Content");

  if (wantsNdjsonStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: object) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        try {
          const { mergedPlan, parseNotices } = await generateTeacherPackage({
            apiKey,
            input,
            sections,
            sourceMaterial,
            frameworkAddendum,
            aflSelections,
            aflPromptBlock,
            onProgress: (message) => send({ type: "progress", message }),
          });
          const payload = await runFluxAndBuildResponsePayload(input, sections, mergedPlan, parseNotices);
          const usage = await recordSuccessfulGeneration(
            auth.supabase,
            auth.userId,
            auth.accessToken,
          );
          send({ type: "complete", ...payload, ...(usage ? { usage } : {}) });
        } catch (e) {
          console.error("[lesson-plan] stream generation failed:", e);
          send({ type: "error", message: USER_FACING_ERROR });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { status: 200, headers: NDJSON_HEADERS });
  }

  try {
    const { mergedPlan, parseNotices } = await generateTeacherPackage({
      apiKey,
      input,
      sections,
      sourceMaterial,
      frameworkAddendum,
      aflSelections,
      aflPromptBlock,
    });
    const payload = await runFluxAndBuildResponsePayload(input, sections, mergedPlan, parseNotices);
    const usage = await recordSuccessfulGeneration(
      auth.supabase,
      auth.userId,
      auth.accessToken,
    );
    return NextResponse.json({ ...payload, ...(usage ? { usage } : {}) });
  } catch (e) {
    console.error("[lesson-plan] generation failed:", e);
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 500 });
  }
}
