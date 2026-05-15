import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  generateLessonPptSlideImages,
  type LessonPptImageGenerationSpec,
} from "@/lib/fal-ppt-slide-images";
import { sanitizeAflSelections } from "@/lib/afl-tools";
import { buildPptxFromPptContent, sanitizeExportFileName } from "@/lib/lesson-plan-export";
import {
  buildStructuredLessonSlides,
  mapLessonPptImagesToDeck,
  type StructuredLessonSlideModel,
} from "@/lib/ppt-structured-lesson";
import {
  buildSchoolTemplatePptRenderTheme,
  DEFAULT_PPT_THEME_ID,
  isValidPptThemeId,
} from "@/lib/ppt-themes";
import { injectTemplateDesign } from "@/lib/pptx-template";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The slide-type label sent to the Python API. */
const SLIDE_TYPE_MAP: Record<number, string> = {
  0: "title",
  1: "starter",
  2: "objectives",
  3: "vocabulary",
  4: "context",
  5: "main",
  6: "main2",
  7: "activity",
  8: "plenary",
  9: "differentiated",
  10: "exit_ticket",
  11: "success_criteria",
  12: "closing",
};

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
  /** Signals that the teacher has a school template — triggers DB lookup + Python API. */
  useSchoolTemplate?: boolean;
  /** Fallback colour theme extracted from the school template. */
  schoolTemplateTheme?: {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    darkColor?: string;
    fontFace?: string;
  };
  /** Base64 data URI of the school logo (stamped on slides in the fallback path). */
  schoolLogo?: string;
};

// ── Supabase helper ───────────────────────────────────────────────────────────

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
      console.log("[pptx export] No file_data stored in DB for this user.");
      return null;
    }
    console.log("[pptx export] Template file_data fetched from DB, base64 length:", (data.file_data as string).length);
    return Buffer.from(data.file_data as string, "base64");
  } catch (e) {
    console.error("[pptx export] fetchTemplateFileData exception:", e);
    return null;
  }
}

// ── Python API call ───────────────────────────────────────────────────────────

async function callPythonPptApi(
  templateBuffer: Buffer,
  deck: StructuredLessonSlideModel[],
  meta: { topic: string; subject: string; grade: string; teacherName: string },
): Promise<Buffer | null> {
  const apiUrl = process.env.PYTHON_PPT_API_URL?.trim();
  if (!apiUrl) {
    console.log("[pptx export] PYTHON_PPT_API_URL not set — skipping Python API.");
    return null;
  }

  console.log(`[pptx export] ✦ Calling Python PPT API at: ${apiUrl}`);

  try {
    // Build slides payload
    const slidesPayload = {
      topic: meta.topic,
      subject: meta.subject,
      grade: meta.grade,
      teacherName: meta.teacherName,
      slides: deck.map((slide, idx) => ({
        index: idx,
        type: SLIDE_TYPE_MAP[idx] ?? "content",
        title: slide.slideTitle,
        content: slide.body,
        speakerNotes: slide.speakerNotes ?? "",
      })),
    };

    // Build multipart form
    const formData = new FormData();
    const templateBlob = new Blob([new Uint8Array(templateBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    formData.append("template", templateBlob, "template.pptx");
    formData.append("slides", JSON.stringify(slidesPayload));

    console.log(`[pptx export] Sending ${deck.length} slides to Python API...`);

    const res = await fetch(`${apiUrl}/generate-ppt`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(55_000), // 55s timeout
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) errMsg += `: ${j.error}`;
      } catch { /* ignore */ }
      console.error("[pptx export] Python API returned error:", errMsg);
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    console.log(`[pptx export] ✦ Python API returned PPTX: ${buf.length} bytes`);
    return buf;
  } catch (e) {
    console.error("[pptx export] Python API call failed:", e);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const subject          = body.subject?.trim();
  const grade            = body.grade?.trim();
  const topic            = body.topic?.trim();
  const pptContent       = typeof body.pptContent       === "string" ? body.pptContent.trim()       : "";
  const fullLessonPlan   = typeof body.fullLessonPlan   === "string" ? body.fullLessonPlan.trim()    : "";
  const learningObjectives = typeof body.learningObjectives === "string" ? body.learningObjectives.trim() : "";
  const homeworkTask     = typeof body.homeworkTask     === "string" ? body.homeworkTask.trim()      : "";
  const teacherName      = typeof body.teacherName      === "string" ? body.teacherName.trim()       : "";
  const curriculumFramework = typeof body.curriculumFramework === "string" ? body.curriculumFramework.trim() : "";
  const pptThemeRaw      = typeof body.pptTheme         === "string" ? body.pptTheme.trim()          : "";
  const pptTheme         = isValidPptThemeId(pptThemeRaw) ? pptThemeRaw : DEFAULT_PPT_THEME_ID;
  const aflSelections    = sanitizeAflSelections(body.aflSelections);
  const useSchoolTemplate = body.useSchoolTemplate === true;
  const schoolTemplateTheme =
    body.schoolTemplateTheme &&
    typeof body.schoolTemplateTheme === "object" &&
    typeof body.schoolTemplateTheme.primaryColor === "string"
      ? body.schoolTemplateTheme : null;
  const schoolLogo =
    typeof body.schoolLogo === "string" && body.schoolLogo.startsWith("data:")
      ? body.schoolLogo : null;

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

  // ── STEP 0: Template detection — BEFORE generation starts ────────────────
  const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
  let templateBuffer: Buffer | null = null;

  if (useSchoolTemplate && accessToken) {
    console.log("[pptx export] ✦ School template requested — fetching file from DB...");
    templateBuffer = await fetchTemplateFileData(accessToken);
    if (templateBuffer) {
      console.log(`[pptx export] ✦ Using school template (${templateBuffer.length} bytes). Will send to Python API.`);
    } else {
      console.log("[pptx export] ✦ No template file in DB — will use JSZip injection or colour theme.");
    }
  } else {
    console.log("[pptx export] ✦ Using default Layah theme (no school template).");
  }

  try {
    // ── STEP 1: Build structured slide deck ───────────────────────────────
    const deck = buildStructuredLessonSlides({
      subject, grade, topic,
      teacherName: teacherName || "Teacher",
      learningObjectivesText: learningObjectives || undefined,
      fullLessonPlan: fullLessonPlan || undefined,
      pptContent: pptContent || undefined,
      homeworkTask: homeworkTask || undefined,
      ...(Object.keys(aflSelections).length > 0 ? { aflSelections } : {}),
    });

    // ── STEP 2: Try Python API (highest quality — uses actual template) ───
    if (templateBuffer) {
      const pythonBuffer = await callPythonPptApi(
        templateBuffer,
        deck,
        { topic, subject, grade, teacherName: teacherName || "Teacher" },
      );

      if (pythonBuffer) {
        const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt`) || "ppt-content";
        console.log("[pptx export] ✦ Returning Python API PPTX (school template applied).");
        return new NextResponse(new Uint8Array(pythonBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "Content-Disposition": `attachment; filename="${name}.pptx"`,
            "Cache-Control": "no-store",
          },
        });
      }

      // Python API failed — fall back to JSZip injection
      console.log("[pptx export] Python API unavailable — trying JSZip master injection...");
    }

    // ── STEP 3: Generate slide images (for the pptxgenjs fallback path) ──
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
      console.error("[pptx export] Slide image generation failed; continuing:", imgErr);
    }

    // ── STEP 4: Build PPT with pptxgenjs (colour theme + optional logo) ──
    const customRenderTheme = schoolTemplateTheme
      ? buildSchoolTemplatePptRenderTheme({
          primaryColor:    schoolTemplateTheme.primaryColor    ?? "1B3A6B",
          accentColor:     schoolTemplateTheme.accentColor     ?? "F5A623",
          backgroundColor: schoolTemplateTheme.backgroundColor ?? "FFFFFF",
          darkColor:       schoolTemplateTheme.darkColor       ?? "0A1628",
          fontFace:        schoolTemplateTheme.fontFace,
        })
      : undefined;

    let buffer = await buildPptxFromPptContent({
      subject, grade, topic,
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

    // ── STEP 5: JSZip master injection (second-best fallback) ─────────────
    if (templateBuffer) {
      console.log("[pptx export] ✦ Applying JSZip template master injection...");
      try {
        const { injectTemplateDesign } = await import("@/lib/pptx-template");
        buffer = await injectTemplateDesign(buffer, templateBuffer);
        console.log("[pptx export] ✦ JSZip injection complete.");
      } catch (injectErr) {
        console.error("[pptx export] JSZip injection failed — using colour theme:", injectErr);
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
