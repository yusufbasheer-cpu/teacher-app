import { NextResponse } from "next/server";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import { fetchPptImagesWithFallback } from "@/lib/ppt-image-resolver";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { buildStructuredLessonSlides } from "@/lib/ppt-structured-lesson";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  isValidTemplateId as isValidPptThemeId,
} from "@/lib/ppt-template-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

function slideUrlsFromRequestBody(raw: unknown, deckLen: number): (string | null)[] | null {
  if (!Array.isArray(raw) || raw.length < deckLen) return null;
  return Array.from({ length: deckLen }, (_, i) => {
    const x = raw[i];
    return typeof x === "string" && x.trim().length > 0 ? x.trim() : null;
  });
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
  aflSelections?: unknown;
  /** Pre-generated slide images from lesson creation (parallel to deck indices). */
  pptSlideImageUrls?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject           = body.subject?.trim();
  const grade             = body.grade?.trim();
  const topic             = body.topic?.trim();
  const pptContent        = typeof body.pptContent        === "string" ? body.pptContent.trim()        : "";
  const fullLessonPlan    = typeof body.fullLessonPlan    === "string" ? body.fullLessonPlan.trim()     : "";
  const learningObjectives = typeof body.learningObjectives === "string" ? body.learningObjectives.trim() : "";
  const homeworkTask      = typeof body.homeworkTask      === "string" ? body.homeworkTask.trim()       : "";
  const teacherName       = typeof body.teacherName       === "string" ? body.teacherName.trim()        : "";
  const curriculumFramework = typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";
  const pptThemeRaw       = typeof body.pptTheme          === "string" ? body.pptTheme.trim()           : "";
  const pptTheme          = isValidPptThemeId(pptThemeRaw) ? pptThemeRaw : DEFAULT_PPT_THEME_ID;
  const aflSelections     = sanitizeAflSelections(body.aflSelections);

  if (!subject || !grade || !topic) {
    return NextResponse.json({ error: "subject, grade, and topic are required." }, { status: 400 });
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

  console.log("[pptx export] ✦ Using template:", pptTheme);

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
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });

    const fromClient = slideUrlsFromRequestBody(body.pptSlideImageUrls, deck.length);

    let slideImageUrls: (string | null)[];
    if (fromClient !== null) {
      console.log("[pptx export] embedding pre-generated slide images (no new API image calls)");
      slideImageUrls = fromClient;
    } else {
      console.log("[pptx export] no pptSlideImageUrls on request — generating/fetching images (legacy path)");
      slideImageUrls = Array.from({ length: deck.length }, () => null);
      try {
        slideImageUrls = await fetchPptImagesWithFallback(topic, subject, grade, deck.length);
      } catch (imgErr) {
        console.error("[pptx export] Image fetch failed; continuing without images:", imgErr);
      }
    }

    // ── Build the presentation using the selected Layah theme ─────────────
    const buffer = await buildPptxFromPptContent({
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
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pptx export]", message, e);
    return NextResponse.json({ error: `Failed to build PowerPoint: ${message}` }, { status: 500 });
  }
}
