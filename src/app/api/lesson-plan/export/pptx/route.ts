import { NextResponse } from "next/server";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  generateLessonPptSlideImages,
  type LessonPptImageGenerationSpec,
} from "@/lib/fal-ppt-slide-images";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { buildStructuredLessonSlides, mapLessonPptImagesToDeck } from "@/lib/ppt-structured-lesson";
import { DEFAULT_PPT_THEME_ID, isValidPptThemeId } from "@/lib/ppt-themes";

export const runtime = "nodejs";
export const maxDuration = 60;

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
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade = body.grade?.trim();
  const topic = body.topic?.trim();
  const pptContent = typeof body.pptContent === "string" ? body.pptContent.trim() : "";
  const fullLessonPlan =
    typeof body.fullLessonPlan === "string" ? body.fullLessonPlan.trim() : "";
  const learningObjectives =
    typeof body.learningObjectives === "string" ? body.learningObjectives.trim() : "";
  const homeworkTask = typeof body.homeworkTask === "string" ? body.homeworkTask.trim() : "";
  const teacherName = typeof body.teacherName === "string" ? body.teacherName.trim() : "";
  const curriculumFramework =
    typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";
  const pptThemeRaw = typeof body.pptTheme === "string" ? body.pptTheme.trim() : "";
  const pptTheme = isValidPptThemeId(pptThemeRaw) ? pptThemeRaw : DEFAULT_PPT_THEME_ID;
  const aflSelections = sanitizeAflSelections(body.aflSelections);

  if (!subject || !grade || !topic) {
    return NextResponse.json(
      { error: "subject, grade, and topic are required." },
      { status: 400 },
    );
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

  try {
    console.log("[pptx export] POST body lengths (chars):", {
      pptContent: pptContent.length,
      fullLessonPlan: fullLessonPlan.length,
      learningObjectives: learningObjectives.length,
      homeworkTask: homeworkTask.length,
      topicPreview: topic.slice(0, 120),
      aflPhases: Object.keys(aflSelections),
      aflToolCounts: Object.fromEntries(
        Object.entries(aflSelections).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
      ),
      aflSelections,
    });

    const deck = buildStructuredLessonSlides({
      subject,
      grade,
      topic,
      teacherName: teacherName || "Teacher",
      learningObjectivesText: learningObjectives || undefined,
      fullLessonPlan: fullLessonPlan || undefined,
      pptContent: pptContent || undefined,
      homeworkTask: homeworkTask || undefined,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });

    let slideImageUrls: (string | null)[] = Array.from({ length: deck.length }, () => null);
    try {
      const imageSpecs: LessonPptImageGenerationSpec[] = [
        { slot: "title", slideTitle: deck[0]!.slideTitle, bodySnippet: deck[0]!.body },
        { slot: "main_teaching", slideTitle: deck[4]!.slideTitle, bodySnippet: deck[4]!.body },
        { slot: "group_activity", slideTitle: deck[6]!.slideTitle, bodySnippet: deck[6]!.body },
        { slot: "afl_tools", slideTitle: deck[8]!.slideTitle, bodySnippet: deck[8]!.body },
        { slot: "plenary", slideTitle: deck[12]!.slideTitle, bodySnippet: deck[12]!.body },
      ];
      const imageSlideIndices = [0, 4, 6, 8, 12] as const;

      const fluxUrls = await generateLessonPptSlideImages(
        {
          subject,
          grade,
          topic,
        },
        imageSpecs,
      );
      slideImageUrls = mapLessonPptImagesToDeck(deck.length, [...imageSlideIndices], fluxUrls);
    } catch (imgErr) {
      console.error("[pptx export] slide image generation failed; continuing without images:", imgErr);
    }

    const buffer = await buildPptxFromPptContent({
      subject,
      grade,
      topic,
      pptContent: pptContent || fullLessonPlan.slice(0, 1200),
      teacherName: teacherName || "Teacher",
      fullLessonPlan: fullLessonPlan || undefined,
      learningObjectives: learningObjectives || undefined,
      homeworkTask: homeworkTask || undefined,
      structuredSlides: deck,
      slideImageUrls,
      themeId: pptTheme,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });
    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt`) || "ppt-content";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}.pptx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pptx export]", message, e);
    return NextResponse.json(
      { error: `Failed to build PowerPoint: ${message}` },
      { status: 500 },
    );
  }
}
