import { NextResponse } from "next/server";
import {
  authenticateRequest,
  getCallerPlanType,
  refundGeneration,
  reserveGeneration,
} from "@/lib/user-usage-server";
import { getUpgradePitch } from "@/lib/user-usage";
import { PLANS, FEATURE_LOCKED_ERROR_CODE } from "@/lib/plans";
import {
  checkRateLimit,
  checkSpendingProtection,
  getClientIp,
  rateLimitResponse,
  HOUR_MS,
  DAY_MS,
} from "@/lib/rate-limit";
import { sendEmail } from "@/lib/send-email";
import { logGenerationEvent } from "@/lib/generation-events";
import {
  buildCurriculumFrameworkSystemAddendum,
  getCurriculumFrameworkLabel,
  isUaeCurriculumFramework,
  isValidCurriculumFramework,
} from "@/lib/curriculum-framework";
import { buildDeepseekLessonSystemPrompt } from "@/lib/deepseek-lesson-system-prompt";
import {
  resolvePresentationLanguage,
  localeTagFor,
  type PresentationLanguage,
} from "@/lib/ppt-language";
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
  resolveGenerationTopic,
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
  resolveMainPhaseActivity,
  sanitizeAflSelections,
  buildAflActivitySheetsUserMessage,
  buildAutoAflSelections,
} from "@/lib/afl-tools";
import { logDeepSeekRawResponse } from "@/lib/deepseek-log-raw";
import { parseDeepSeekCompletionBody } from "@/lib/deepseek-chat-parse";
import {
  parseTeacherPackageResponse,
  stripOuterMarkdownFences,
} from "@/lib/parse-teacher-package-response";
import {
  assembleFullPptFromSlideBodies,
  parseDeckBodiesFromPptOutline,
  type EarlySlideSanitizeContext,
} from "@/lib/ppt-slide-by-slide";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { generatePptDeckSlideImages } from "@/lib/ppt-image-resolver";
import { buildSlide8PptModeBlock } from "@/lib/ppt-slide-validation";
import {
  generateSlide1Body,
  generateSlide2,
  generateSlide3,
  generateSlide4Body,
  generateSlide5,
  generateSlide6,
  generateSlide7,
  generateSlide8,
  generateSlide9,
  generateSlide10,
  generateSlide11,
  generateSlide12,
  generateSlide13Body,
  type SlideGenParams,
} from "@/lib/ppt-individual-slide-generator";

export const runtime = "nodejs";
/** 13 parallel slide calls + other sections. Parallel PPT is faster but keep the cap generous. */
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
    return "Please fill Topic.";
  }
  if (input.learningObjectives.trim().length === 0) {
    return "Please fill Learning Objectives.";
  }
  if (!isValidCurriculumFramework(input.curriculumFramework)) {
    return "Invalid curriculum framework selection.";
  }
  return null;
}

function buildStrategyBlock(strategy: string | undefined): string {
  const s = strategy?.trim();
  if (!s) return "";
  return `

===== TEACHING AND LEARNING STRATEGY (MANDATORY — read all five rules) =====
The teacher has selected the following pedagogical strategy: **${s}**

RULE 1: The selected teaching strategy must ONLY influence the activities and examples within each lesson phase. It must NOT change the lesson plan structure, add sections, or remove sections.
RULE 2: The lesson plan must still contain ALL standard sections: Learning Objectives, Learning Outcomes, Starter Activity, Main Phase, Differentiated Activity, UAE Real Life Connection, Plenary, Extended Task, Exit Ticket, Success Criteria.
RULE 3: Apply the strategy as follows for each section:
  - Starter Activity: Design the hook activity using the principles of ${s}.
  - Main Phase: Structure the I Do / We Do / You Do activities according to ${s}.
  - Differentiated Activity: Create differentiated tasks that reflect the ${s} approach.
  - Plenary: Design the reflection activity using ${s} principles.
  - Extended Task: Create homework that extends the ${s} approach.
RULE 4: For PPT Slide Content the same rules apply. The 13-slide structure must remain identical. Only the content delivery style, activities, and examples should reflect ${s}. Do NOT add, remove, or rearrange any PPT slides.
RULE 5: If the strategy cannot be naturally applied to a section, use default pedagogy for that section only — do not force it.
===== END STRATEGY RULES =====`;
}

function buildMessages(
  input: LessonPlanInput,
  sections: readonly TeacherPackageSectionKey[],
  sourceMaterial: string | undefined,
  frameworkAddendum: string | null,
  aflPromptBlock: string,
  strategyBlock: string,
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

  const topicLine =
    input.topic.trim().length > 0
      ? `- Topic (within the chapter): ${input.topic.trim()}`
      : `- Topic: (not specified — infer a sensible topic scope from the chapter/unit and grade above)`;

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
        grade: input.grade.trim(),
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
${topicLine}
- Teacher-provided learning objectives / focus: ${input.learningObjectives.trim()}${frameworkUserLine}
${sourceBlock}
${aflPromptBlock}
${languageUserBlock}

Follow every instructional design rule in the system prompt that applies to the outputs you are generating. Align examples, vocabulary, and progression to the curriculum and grade named above. Each requested section must be classroom-ready (not placeholders). **PPT Slide Content** must read as finished on-screen text for learners (no teacher coaching phrases in the slide body).
${strategyBlock}
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

/**
 * Generates all 13 PPT slides in parallel using completely isolated generator functions.
 * Each slide has its own focused DeepSeek call — no shared lesson-plan context is passed,
 * making content bleeding between slides physically impossible.
 */
async function generatePptSlideContentSlideBySlide(params: {
  apiKey: string;
  input: LessonPlanInput;
  sourceMaterial: string | undefined;
  frameworkAddendum: string | null;
  aflSelections: ReturnType<typeof sanitizeAflSelections>;
  fullLessonPlan: string;
  onProgress: (message: string) => void;
}): Promise<{ text: string; notices: string[] }> {
  const { input, aflSelections, onProgress } = params;
  const notices: string[] = [];
  const language: PresentationLanguage = resolvePresentationLanguage({
    language: input.language,
    subject: input.subject,
  });
  const isAr = language === "ar";
  const uaeFrameworkEnabled = isUaeCurriculumFramework(input.curriculumFramework);

  console.log(
    `[ppt-deck] slide-8 mode: ${uaeFrameworkEnabled ? "UAE Framework" : "global connection (no UAE)"}`,
  );

  const locale = localeTagFor(language);
  const dateStr = new Date().toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Build AFL blocks for the three slides that use them
  const makeAflBlock = (slide: number) =>
    formatAflForSinglePptSlidePrompt(slide, aflSelections, {
      subject: input.subject.trim(),
      grade: input.grade.trim(),
      topic: resolveGenerationTopic(input.topic, input.chapter),
      learningObjectives: input.learningObjectives.trim(),
    });

  const slideParams: SlideGenParams = {
    topic: resolveGenerationTopic(input.topic, input.chapter),
    subject: input.subject.trim(),
    grade: input.grade.trim(),
    chapter: input.chapter.trim(),
    curriculumType: input.curriculumType.trim(),
    learningObjectives: input.learningObjectives.trim(),
    starterAflBlock: makeAflBlock(2),
    mainAflBlock: makeAflBlock(6),
    plenaryAflBlock: makeAflBlock(9),
    // Previously unwired, though PPT_SLIDE_AFL_BINDINGS has always declared them: the teacher's
    // differentiation / exit-ticket / success-criteria picks never reached any prompt.
    differentiationAflBlock: makeAflBlock(7),
    exitTicketAflBlock: makeAflBlock(11),
    successCriteriaAflBlock: makeAflBlock(12),
    mainActivity: resolveMainPhaseActivity(aflSelections, {
      subject: input.subject.trim(),
      grade: input.grade.trim(),
      topic: resolveGenerationTopic(input.topic, input.chapter),
      learningObjectives: input.learningObjectives.trim(),
    }),
    ...(input.teachingStrategy?.trim() ? { teachingStrategy: input.teachingStrategy.trim() } : {}),
    language,
    uaeFrameworkEnabled,
    dateStr,
  };

  // Shared completion counter — safe across parallel closures (JS is single-threaded at await points)
  let completedCount = 0;

  const track = <T>(resultPromise: Promise<{ body: string; notices: string[] }>): Promise<string> =>
    resultPromise.then((r) => {
      notices.push(...r.notices);
      onProgress(`Generating Slide ${++completedCount} of ${STRUCTURED_LESSON_DECK_SLIDE_COUNT}`);
      return r.body;
    });

  const trackSync = (result: { body: string; notices: string[] }): string => {
    notices.push(...result.notices);
    onProgress(`Generating Slide ${++completedCount} of ${STRUCTURED_LESSON_DECK_SLIDE_COUNT}`);
    return result.body;
  };

  console.log(`[ppt-deck] Launching ${STRUCTURED_LESSON_DECK_SLIDE_COUNT} isolated parallel slide generators`);

  // All 13 slide generators run simultaneously — Promise.allSettled ensures a single
  // slide failure never blocks or cancels any other slide.
  const [
    r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13,
  ] = await Promise.allSettled([
    Promise.resolve(trackSync(generateSlide1Body(slideParams))),   // programmatic
    track(generateSlide2(slideParams)),                             // starter
    track(generateSlide3(slideParams)),                             // chapter/SDG
    Promise.resolve(trackSync(generateSlide4Body(slideParams))),   // programmatic
    track(generateSlide5(slideParams)),                             // outcomes
    track(generateSlide6(slideParams)),                             // main phase
    track(generateSlide7(slideParams)),                             // differentiated
    track(generateSlide8(slideParams)),                             // UAE/real life
    track(generateSlide9(slideParams)),                             // plenary
    track(generateSlide10(slideParams)),                            // extended task
    track(generateSlide11(slideParams)),                            // exit ticket
    track(generateSlide12(slideParams)),                            // success criteria
    Promise.resolve(trackSync(generateSlide13Body(slideParams))),  // programmatic
  ]);

  const bodies = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13].map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    notices.push(`PPT Slide ${i + 1} rejected — ${reason}`);
    return `_(Slide ${i + 1} could not be generated — please regenerate.)_`;
  });

  console.log(`[ppt-deck] All ${STRUCTURED_LESSON_DECK_SLIDE_COUNT} slides complete — ${completedCount} ready`);

  return {
    text: assembleFullPptFromSlideBodies(bodies, isAr, uaeFrameworkEnabled),
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
  strategyBlock: string;
  onProgress?: (message: string) => void;
};

async function generateTeacherPackage(params: GeneratePackageParams): Promise<{
  mergedPlan: LessonPlanResult;
  parseNotices: string[];
}> {
  const { apiKey, input, sections, sourceMaterial, frameworkAddendum, aflSelections, aflPromptBlock, strategyBlock, onProgress } =
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
      // If the teacher didn't pick specific tools, fall back to the same
      // deterministic per-slide picks the PPT auto-select prompt is given —
      // otherwise these sheets would go blank even though the PPT still
      // used AFL tools on slides 2/6/7/9/11/12.
      const hasTeacherAflPicks = Object.values(aflSelections).some((ids) => (ids?.length ?? 0) > 0);
      const effectiveAflSelections = hasTeacherAflPicks
        ? aflSelections
        : buildAutoAflSelections({
            subject: input.subject,
            grade: input.grade,
            topic: resolveGenerationTopic(input.topic, input.chapter),
            learningObjectives: input.learningObjectives,
          });
      const userMsg = buildAflActivitySheetsUserMessage({
        input: {
          subject: input.subject,
          grade: input.grade,
          topic: resolveGenerationTopic(input.topic, input.chapter),
          chapter: input.chapter,
          curriculumType: input.curriculumType,
        },
        selections: effectiveAflSelections,
        sourceMaterialBlock,
        isRecommended: !hasTeacherAflPicks,
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
          messages: buildMessages(input, [section], sourceMaterial, frameworkAddendum, aflPromptBlock, strategyBlock),
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
      // Feed each slide's own generated text into its image prompt so the four Fal-required
      // slides get contextually specific artwork rather than generic subject-level imagery.
      const deckLanguage = resolvePresentationLanguage({
        language: input.language,
        subject: input.subject,
      });
      const slideContentByIndex = parseDeckBodiesFromPptOutline(
        workingPlan["PPT Slide Content"] ?? "",
        deckLanguage === "ar",
        isUaeCurriculumFramework(input.curriculumFramework),
      );
      const { urls, notices: imgNotices, diagnostics } = await generatePptDeckSlideImages({
        topic: input.topic.trim(),
        subject: input.subject.trim(),
        grade: input.grade.trim(),
        curriculumFramework: input.curriculumFramework.trim() || undefined,
        ...(slideContentByIndex ? { slideContentByIndex } : {}),
      });
      workingPlan = mergePptSlideImageUrlsIntoPlan(workingPlan, urls);
      pptSlideImageUrls = urls;
      imageNotices.push(...imgNotices);
      // console.error so provider selection stays observable in production, where
      // `removeConsole` strips console.log.
      console.error(
        "[lesson-plan] PPT deck image providers:",
        JSON.stringify(
          diagnostics.map((d) => ({
            slide: d.slideNumber1Based,
            policy: d.policy,
            provider: d.resolvedProvider,
            ...(d.falFailureKind ? { falFailure: d.falFailureKind } : {}),
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
    // Resolved once here so every downstream consumer sees the same answer. An explicit
    // selection wins; otherwise this reproduces the old subject-derived behaviour.
    language: resolvePresentationLanguage({ language: body.language, subject: body.subject }),
    ...(typeof body.teachingStrategy === "string" && body.teachingStrategy.trim()
      ? { teachingStrategy: body.teachingStrategy.trim() }
      : {}),
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

  // Entitlement gate — runs before any rate-limit/spend/quota work so a
  // rejected request never consumes a generation. The frontend disables
  // these controls for Free users; this is the actual security boundary.
  const planType = await getCallerPlanType(auth.supabase, auth.userId);
  const plan = PLANS[planType];
  const aflSelections = sanitizeAflSelections(body.aflSelections);
  const wantsAfl = Object.values(aflSelections).some((ids) => (ids?.length ?? 0) > 0);
  const wantsStrategy =
    typeof body.teachingStrategy === "string" && body.teachingStrategy.trim().length > 0;
  const wantsSourceContent = (sourceMaterial ?? "").trim().length > 0;
  const disallowedSections = sections.filter((s) => !plan.allowedSections.includes(s));

  if (
    disallowedSections.length > 0 ||
    (wantsAfl && !plan.afl) ||
    (wantsStrategy && !plan.teachingStrategy) ||
    (wantsSourceContent && !plan.sourceContent)
  ) {
    return NextResponse.json(
      {
        error: "Your plan doesn't include one or more of the requested features. Upgrade to Pro to unlock them.",
        code: FEATURE_LOCKED_ERROR_CODE,
      },
      { status: 403 },
    );
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

  const gate = await reserveGeneration(auth.supabase, auth.userId);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: gate.message,
        code: gate.code,
        usage: gate.usage,
        upgradePitch: {
          headline: gate.message,
          subline: getUpgradePitch(gate.usage.planType).subline,
        },
      },
      { status: gate.status },
    );
  }

  const genStartedAt = Date.now();

  const frameworkAddendum = buildCurriculumFrameworkSystemAddendum(input.curriculumFramework);

  const aflCtx = {
    subject: input.subject.trim(),
    grade: input.grade.trim(),
    topic: resolveGenerationTopic(input.topic, input.chapter),
    learningObjectives: input.learningObjectives.trim(),
  };
  const aflFormatted = formatAflForAiPrompt(aflSelections, aflCtx);
  const aflPromptBlock = aflFormatted ? `\n\n${aflFormatted}` : "";

  const strategyBlock = buildStrategyBlock(
    typeof body.teachingStrategy === "string" ? body.teachingStrategy : undefined,
  );

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
            strategyBlock,
            onProgress: (message) => send({ type: "progress", message }),
          });
          const payload = await runFluxAndBuildResponsePayload(input, sections, mergedPlan, parseNotices);
          send({ type: "complete", ...payload, usage: gate.usage });
          void logGenerationEvent({
            userId: auth.userId,
            generationType: "lesson_plan",
            status: "success",
            planType,
            durationMs: Date.now() - genStartedAt,
          });
        } catch (e) {
          console.error("[lesson-plan] stream generation failed:", e);
          await refundGeneration(gate.reservation);
          send({ type: "error", message: USER_FACING_ERROR });
          void logGenerationEvent({
            userId: auth.userId,
            generationType: "lesson_plan",
            status: "failed",
            planType,
            errorMessage: e instanceof Error ? e.message : String(e),
            durationMs: Date.now() - genStartedAt,
          });
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
      strategyBlock,
    });
    const payload = await runFluxAndBuildResponsePayload(input, sections, mergedPlan, parseNotices);
    void logGenerationEvent({
      userId: auth.userId,
      generationType: "lesson_plan",
      status: "success",
      planType,
      durationMs: Date.now() - genStartedAt,
    });
    return NextResponse.json({ ...payload, usage: gate.usage });
  } catch (e) {
    console.error("[lesson-plan] generation failed:", e);
    await refundGeneration(gate.reservation);
    void logGenerationEvent({
      userId: auth.userId,
      generationType: "lesson_plan",
      status: "failed",
      planType,
      errorMessage: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - genStartedAt,
    });
    return NextResponse.json({ error: USER_FACING_ERROR }, { status: 500 });
  }
}
