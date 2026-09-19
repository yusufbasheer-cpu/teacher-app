import { NextResponse } from "next/server";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  FAL_REQUIRED_DECK_INDICES,
  generatePptDeckSlideImages,
} from "@/lib/ppt-image-resolver";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  isValidTemplateId as isValidPptThemeId,
} from "@/lib/ppt-template-config";
import { resolvePresentationLanguage } from "@/lib/ppt-language";
import { authenticateRequest } from "@/lib/user-usage-server";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";
import { renderUploadedPpt, UploadedTemplateError } from "@/lib/uploaded-ppt-export";
import { moveTeacherFacingLinesToNotes } from "@/lib/ppt-template-engine";

export const runtime = "nodejs";
export const maxDuration = 180;

function slideUrlsFromRequestBody(raw: unknown, deckLen: number): (string | null)[] | null {
  if (!Array.isArray(raw) || raw.length < deckLen) return null;
  return Array.from({ length: deckLen }, (_, i) => {
    const x = raw[i];
    return typeof x === "string" && x.trim().length > 0 ? x.trim() : null;
  });
}

function isPexelsUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /\bpexels\.com\b/i.test(url);
}

function needsFalRequiredImageRepair(urls: readonly (string | null)[]): boolean {
  return FAL_REQUIRED_DECK_INDICES.some((idx) => !urls[idx] || isPexelsUrl(urls[idx]));
}

type Body = {
  subject?: string;
  grade?: string;
  topic?: string;
  pptContent?: string;
  fullLessonPlan?: string;
  learningObjectives?: string;
  homeworkTask?: string;
  teacherName?: string;
  curriculumFramework?: string;
  pptTheme?: string;
  templateMode?: "layah" | "uploaded";
  aflSelections?: unknown;
  /** Pre-generated slide images from lesson creation (parallel to deck indices). */
  pptSlideImageUrls?: unknown;
  /** Deck language; falls back to subject inference when absent (older clients). */
  language?: unknown;
  /** Chapter was never forwarded here, which disabled the slide-2 chapter dedupe. */
  chapter?: string;
  teachingStrategy?: string;
};

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const ipLimit = checkRateLimit(`lesson-plan-export-pptx:ip:${getClientIp(req)}`, 20, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject           = body.subject?.trim();
  const grade             = body.grade?.trim();
  const topic             = body.topic?.trim() || "Lesson";
  const pptContent        = typeof body.pptContent        === "string" ? body.pptContent.trim()        : "";
  const fullLessonPlan    = typeof body.fullLessonPlan    === "string" ? body.fullLessonPlan.trim()     : "";
  const learningObjectives = typeof body.learningObjectives === "string" ? body.learningObjectives.trim() : "";
  const homeworkTask      = typeof body.homeworkTask      === "string" ? body.homeworkTask.trim()       : "";
  const teacherName       = typeof body.teacherName       === "string" ? body.teacherName.trim()        : "";
  const curriculumFramework = typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";
  const pptThemeRaw       = typeof body.pptTheme          === "string" ? body.pptTheme.trim()           : "";
  const pptTheme          = isValidPptThemeId(pptThemeRaw) ? pptThemeRaw : DEFAULT_PPT_THEME_ID;
  const aflSelections     = sanitizeAflSelections(body.aflSelections);
  const chapter           = typeof body.chapter === "string" ? body.chapter.trim() : "";
  const language          = resolvePresentationLanguage({ language: body.language, subject });

  if (!subject || !grade) {
    return NextResponse.json({ error: "subject and grade are required." }, { status: 400 });
  }
  if (!pptContent && !fullLessonPlan) {
    return NextResponse.json(
      { error: "Provide pptContent and/or fullLessonPlan for the presentation." },
      { status: 400 },
    );
  }
  if (!isValidCurriculumFramework(curriculumFramework)) {
    return NextResponse.json({ error: "Invalid curriculumFramework." }, { status: 400 });
  }

  if (body.templateMode && body.templateMode !== "layah" && body.templateMode !== "uploaded") {
    return NextResponse.json({ error: "Invalid template mode." }, { status: 400 });
  }

  let uploadedTemplate: Buffer | null = null;
  const serviceUrl = process.env.PPT_TEMPLATE_SERVICE_URL?.replace(/\/$/, "");
  const serviceSecret = process.env.PPT_TEMPLATE_SERVICE_SECRET;
  if (body.templateMode === "uploaded") {
    if (!serviceUrl || !serviceSecret) {
      return NextResponse.json({ code: "TEMPLATE_SERVICE_UNAVAILABLE", error: "Uploaded PowerPoint exports are temporarily unavailable. Please use a Layah template." }, { status: 503 });
    }
    const { data, error } = await auth.supabase
      .from("school_templates")
      .select("file_data")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (error) {
      console.error("[pptx export] saved template lookup failed", error);
      return NextResponse.json({ code: "TEMPLATE_LOOKUP_FAILED", error: "We couldn't load your saved PowerPoint. Please retry or use a Layah template." }, { status: 503 });
    }
    if (!data?.file_data) {
      return NextResponse.json({ code: "TEMPLATE_MISSING", error: "Upload a PowerPoint before exporting, or use a Layah template." }, { status: 404 });
    }
    uploadedTemplate = Buffer.from(data.file_data, "base64");
    if (uploadedTemplate.length === 0 || uploadedTemplate.length > 15 * 1024 * 1024 || uploadedTemplate.subarray(0, 2).toString() !== "PK") {
      return NextResponse.json({ code: "INVALID_TEMPLATE", error: "The saved PowerPoint is invalid. Please upload it again." }, { status: 422 });
    }
  }

  console.log("[pptx export] using design:", body.templateMode === "uploaded" ? "uploaded" : pptTheme);

  try {
    // ── Build structured slide deck ───────────────────────────────────────
    const deck = buildStructuredLessonSlides({
      subject, grade, topic,
      teacherName: teacherName || "Teacher",
      learningObjectivesText: learningObjectives || undefined,
      fullLessonPlan: fullLessonPlan || undefined,
      pptContent: pptContent || undefined,
      homeworkTask: homeworkTask || undefined,
      curriculumFramework: curriculumFramework || undefined,
      ...(chapter ? { chapter } : {}),
      language,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });

    const fromClient = slideUrlsFromRequestBody(body.pptSlideImageUrls, deck.length);
    const slideContentByIndex = deck.map((slide) =>
      `${slide.slideTitle}. ${slide.body}`.replace(/\s+/g, " ").trim(),
    );
    const slideTitleByIndex = deck.map((slide) => slide.slideTitle);

    let slideImageUrls: (string | null)[];
    if (fromClient !== null) {
      console.log("[pptx export] embedding pre-generated slide images (no new API image calls)");
      slideImageUrls = fromClient;
      if (needsFalRequiredImageRepair(slideImageUrls)) {
        console.error(
          "[pptx export] pre-generated slide images are missing Fal-required slots; repairing before export",
        );
        const repaired = await generatePptDeckSlideImages({
          topic,
          subject,
          grade,
          chapter: chapter || undefined,
          learningObjectives: learningObjectives || undefined,
          curriculumFramework: curriculumFramework || undefined,
          slideContentByIndex,
          slideTitleByIndex,
        });
        slideImageUrls = slideImageUrls.map((url, idx) =>
          FAL_REQUIRED_DECK_INDICES.includes(idx as (typeof FAL_REQUIRED_DECK_INDICES)[number])
            ? repaired.urls[idx] ?? url
            : url ?? repaired.urls[idx] ?? null,
        );
      }
    } else {
      console.log("[pptx export] no pptSlideImageUrls on request — generating/fetching images (legacy path)");
      slideImageUrls = Array.from({ length: deck.length }, () => null);
      try {
        const generated = await generatePptDeckSlideImages({
          topic,
          subject,
          grade,
          chapter: chapter || undefined,
          learningObjectives: learningObjectives || undefined,
          curriculumFramework: curriculumFramework || undefined,
          slideContentByIndex,
          slideTitleByIndex,
        });
        slideImageUrls = Array.from({ length: deck.length }, (_, i) => generated.urls[i] ?? null);
      } catch (imgErr) {
        console.error("[pptx export] Image fetch failed; continuing without images:", imgErr);
      }
    }

    // Reuse the source deck for uploaded designs; the Layah renderer keeps its existing path.
    const buffer = uploadedTemplate && serviceUrl && serviceSecret
      ? await renderUploadedPpt({
          template: uploadedTemplate,
          slides: deck.map(moveTeacherFacingLinesToNotes),
          slideImageUrls,
          serviceUrl,
          serviceSecret,
        })
      : await buildPptxFromPptContent({
          subject, grade, topic,
          pptContent: pptContent || fullLessonPlan.slice(0, 1200),
          teacherName: teacherName || "Teacher",
          fullLessonPlan: fullLessonPlan || undefined,
          learningObjectives: learningObjectives || undefined,
          homeworkTask: homeworkTask || undefined,
          structuredSlides: deck,
          slideImageUrls,
          themeId: pptTheme,
          curriculumFramework: curriculumFramework || undefined,
          language,
          ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
        });

    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt`) || "ppt-content";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof UploadedTemplateError) {
      return NextResponse.json({ code: e.code, error: e.message, slide: e.slide }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pptx export]", message, e);
    return NextResponse.json({ error: `Failed to build PowerPoint: ${message}` }, { status: 500 });
  }
}
