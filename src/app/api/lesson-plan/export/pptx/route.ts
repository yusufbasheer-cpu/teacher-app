import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  generateLessonPptSlideImages,
  type LessonPptImageGenerationSpec,
} from "@/lib/fal-ppt-slide-images";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import { buildStructuredLessonSlides, mapLessonPptImagesToDeck } from "@/lib/ppt-structured-lesson";
import {
  buildSchoolTemplatePptRenderTheme,
  DEFAULT_PPT_THEME_ID,
  isValidPptThemeId,
} from "@/lib/ppt-themes";
import { injectTemplateDesign } from "@/lib/pptx-template";

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
  /** Signals that the teacher has a school template — triggers DB lookup of the full file. */
  useSchoolTemplate?: boolean;
  /** Fallback color theme from the school template (used to style content text/bars). */
  schoolTemplateTheme?: {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    darkColor?: string;
    fontFace?: string;
  };
  /** Base64 data URI of the logo extracted from the school .pptx template. */
  schoolLogo?: string;
};

/** Fetch the saved school template file_data for a user (server-side Supabase call). */
async function fetchTemplateFileData(accessToken: string): Promise<Buffer | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      console.warn("[pptx export] fetchTemplateFileData: invalid token");
      return null;
    }

    const { data, error } = await supabase
      .from("school_templates")
      .select("file_data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[pptx export] fetchTemplateFileData DB error:", error.message);
      return null;
    }

    if (!data?.file_data) {
      console.log("[pptx export] fetchTemplateFileData: no file_data stored for user", user.id);
      return null;
    }

    console.log("[pptx export] fetchTemplateFileData: retrieved file_data, base64 length:", data.file_data.length);
    return Buffer.from(data.file_data as string, "base64");
  } catch (e) {
    console.error("[pptx export] fetchTemplateFileData exception:", e);
    return null;
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const grade   = body.grade?.trim();
  const topic   = body.topic?.trim();
  const pptContent         = typeof body.pptContent     === "string" ? body.pptContent.trim()      : "";
  const fullLessonPlan     = typeof body.fullLessonPlan === "string" ? body.fullLessonPlan.trim()   : "";
  const learningObjectives = typeof body.learningObjectives === "string" ? body.learningObjectives.trim() : "";
  const homeworkTask       = typeof body.homeworkTask   === "string" ? body.homeworkTask.trim()     : "";
  const teacherName        = typeof body.teacherName    === "string" ? body.teacherName.trim()      : "";
  const curriculumFramework = typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";
  const pptThemeRaw = typeof body.pptTheme === "string" ? body.pptTheme.trim() : "";
  const pptTheme = isValidPptThemeId(pptThemeRaw) ? pptThemeRaw : DEFAULT_PPT_THEME_ID;
  const aflSelections = sanitizeAflSelections(body.aflSelections);

  const useSchoolTemplate = body.useSchoolTemplate === true;
  const schoolTemplateTheme =
    body.schoolTemplateTheme &&
    typeof body.schoolTemplateTheme === "object" &&
    typeof body.schoolTemplateTheme.primaryColor === "string"
      ? body.schoolTemplateTheme
      : null;
  const schoolLogo =
    typeof body.schoolLogo === "string" && body.schoolLogo.startsWith("data:")
      ? body.schoolLogo
      : null;

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

  // ── STEP 0: Template detection — happens BEFORE generation ────────────────
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "").trim() ?? null;

  let templateBuffer: Buffer | null = null;

  if (useSchoolTemplate && accessToken) {
    console.log("[pptx export] ✦ School template requested — fetching from DB...");
    templateBuffer = await fetchTemplateFileData(accessToken);
    if (templateBuffer) {
      console.log(`[pptx export] ✦ School template file loaded (${templateBuffer.length} bytes). Will inject design after generation.`);
    } else {
      console.log("[pptx export] ✦ School template requested but file not found in DB — falling back to color theme.");
    }
  } else {
    console.log("[pptx export] ✦ Using default Layah theme (no school template uploaded).");
  }

  try {
    console.log("[pptx export] Building lesson PPT:", {
      subject, grade,
      topicPreview: topic.slice(0, 80),
      usingSchoolTemplate: !!templateBuffer,
      usingColorTheme: !!schoolTemplateTheme && !templateBuffer,
    });

    // ── STEP 1: Build structured slide models ─────────────────────────────
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

    // ── STEP 2: Generate slide images ─────────────────────────────────────
    let slideImageUrls: (string | null)[] = Array.from({ length: deck.length }, () => null);
    try {
      const imageSpecs: LessonPptImageGenerationSpec[] = [
        { slot: "starter",       slideTitle: deck[1]!.slideTitle, bodySnippet: deck[1]!.body },
        { slot: "main_teaching", slideTitle: deck[5]!.slideTitle, bodySnippet: deck[5]!.body },
        { slot: "plenary",       slideTitle: deck[8]!.slideTitle, bodySnippet: deck[8]!.body },
      ];
      const imageSlideIndices = [1, 5, 8] as const;
      const fluxUrls = await generateLessonPptSlideImages({ subject, grade, topic }, imageSpecs);
      slideImageUrls = mapLessonPptImagesToDeck(deck.length, [...imageSlideIndices], fluxUrls);
    } catch (imgErr) {
      console.error("[pptx export] Slide image generation failed; continuing without images:", imgErr);
    }

    // ── STEP 3: Apply colour theme (always — template injection overrides later) ─
    const customRenderTheme = schoolTemplateTheme
      ? buildSchoolTemplatePptRenderTheme({
          primaryColor:    schoolTemplateTheme.primaryColor    ?? "1B3A6B",
          accentColor:     schoolTemplateTheme.accentColor     ?? "F5A623",
          backgroundColor: schoolTemplateTheme.backgroundColor ?? "FFFFFF",
          darkColor:       schoolTemplateTheme.darkColor       ?? "0A1628",
          fontFace:        schoolTemplateTheme.fontFace,
        })
      : undefined;

    // ── STEP 4: Generate the base PPTX with pptxgenjs ────────────────────
    let buffer = await buildPptxFromPptContent({
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
      customRenderTheme,
      schoolLogo: schoolLogo ?? undefined,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });

    // ── STEP 5: Inject school template design (masters + theme + media) ──
    if (templateBuffer) {
      console.log("[pptx export] ✦ Injecting school template design into generated PPTX...");
      try {
        buffer = await injectTemplateDesign(buffer, templateBuffer);
        console.log("[pptx export] ✦ School template design injection COMPLETE.");
      } catch (injectErr) {
        console.error("[pptx export] Template injection failed — returning colour-themed version:", injectErr);
      }
    }

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
