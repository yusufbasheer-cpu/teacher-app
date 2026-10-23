import { NextResponse } from "next/server";
import { isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  FAL_REQUIRED_DECK_INDICES,
  generatePptDeckSlideImages,
  type SlideImageDiagnostic,
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
import { renderUploadedPpt, UploadedTemplateError } from "@/lib/uploaded-ppt-export";
import { moveTeacherFacingLinesToNotes } from "@/lib/ppt-template-engine";
import { defaultProviderFor, GammaError, gammaGate, getGammaConfig, resolvePptProvider } from "@/lib/gamma/config";
import { encodeReportHeader, summariseReport } from "@/lib/gamma/report";
import { renderPptxWithGamma } from "@/lib/gamma/render";
import { listGammaThemes, validateGammaPresentationOptions } from "@/lib/gamma/themes";
import { buildCanonicalSlides, buildGammaPayload } from "@/lib/gamma/payload";
import { extractPptx } from "@/lib/gamma/validate";
import {
  buildRequiredVisualIntents,
  REQUIRED_VISUAL_DECK_INDICES,
  verifyRequiredVisualCoverage,
  type RequiredVisualCoverageReport,
} from "@/lib/ppt-visual-intent";
import { SupabaseGammaStore } from "@/lib/gamma/store";
import { gammaUserMessage } from "@/lib/gamma/user-messages";
import { createHash } from "node:crypto";

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

function requiredImageRepairIndices(urls: readonly (string | null)[]): number[] {
  return [...new Set([
    ...REQUIRED_VISUAL_DECK_INDICES.filter((idx) => !urls[idx]),
    ...FAL_REQUIRED_DECK_INDICES.filter((idx) => !urls[idx] || isPexelsUrl(urls[idx])),
  ])];
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
  /** Experimental renderer choice; honoured only for authorised testers (see lib/gamma/config). */
  pptProvider?: unknown;
  gammaThemeId?: unknown;
  gammaImageSource?: unknown;
  gammaImageStyle?: unknown;
  artifactLookup?: boolean;
};

const GAMMA_ERROR_STATUS: Record<GammaError["code"], number> = {
  missing_credentials: 503,
  invalid_credentials: 502,
  insufficient_credits: 503,
  bad_request: 502,
  rate_limited: 429,
  request_timeout: 504,
  poll_timeout: 504,
  deadline_exceeded: 504,
  submission_unknown: 409,
  generation_failed: 502,
  generation_in_progress: 409,
  api_error: 502,
  download_rejected: 502,
  invalid_export: 502,
  export_host_unconfigured: 503,
  store_unavailable: 503,
  user_rate_limited: 429,
  budget_exceeded: 429,
  duplicate_in_flight: 409,
  card_limit_exceeded: 422,
};

/** Tells the tester UI whether Gamma is selectable and what the server default is. Reveals nothing else. */
export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  return NextResponse.json({
    gammaAvailable: gammaGate(auth.email).available,
    defaultProvider: defaultProviderFor(auth.email),
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
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

    // ── Experimental Gamma renderer: same deck, no legacy image services. Default stays "legacy". ──
    if (body.templateMode !== "uploaded") {
      const choice = resolvePptProvider({ requested: body.pptProvider, email: auth.email });
      if (choice.provider === "gamma") {
        let requestConfig;
        if (body.gammaThemeId || body.gammaImageSource || body.gammaImageStyle) {
          const baseConfig = getGammaConfig();
          const themes = body.gammaThemeId ? await listGammaThemes(baseConfig) : [];
          const options = validateGammaPresentationOptions({ themeId: body.gammaThemeId, imageSource: body.gammaImageSource, imageStyle: body.gammaImageStyle }, themes);
          requestConfig = { ...baseConfig, ...options };
        }
        const lesson = { topic, subject, grade, ...(chapter ? { chapter } : {}) };
        if (body.artifactLookup === true) {
          const config = requestConfig ?? getGammaConfig();
          const built = buildGammaPayload({ deck, title: `${grade} ${subject}: ${topic}`, language, config, lesson });
          const requestHash = createHash("sha256").update(JSON.stringify(built.request)).digest("hex");
          const imageOptions = built.request.imageOptions as { source?: string; style?: string } | undefined;
          const row = await new SupabaseGammaStore().findReusableArtifact({ userId: auth.userId, requestHash, themeId: typeof built.request.themeId === "string" ? built.request.themeId : null, imageSource: imageOptions?.source ?? null, imageStyle: imageOptions?.style ?? null });
          return NextResponse.json({ available: Boolean(row?.artifactPath), requestHash, validation: row?.validationReport ?? null });
        }
        const result = await renderPptxWithGamma({
          deck,
          title: `${grade} ${subject}: ${topic}`,
          language,
          userId: auth.userId,
          lesson,
          startedAt,
          ...(requestConfig ? { config: requestConfig } : {}),
        });
        const gammaName = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt-gamma`) || "ppt-gamma";
        return new NextResponse(new Uint8Array(result.buffer), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "Content-Disposition": `attachment; filename="${gammaName}.pptx"`,
            "Cache-Control": "no-store",
            "X-Layah-PPT-Provider": "gamma",
            "X-Layah-Gamma-Validation": result.validation.verdict,
            "X-Layah-PPT-Visual-Validation": result.validation.requiredVisuals?.verdict ?? "uncertain",
            "X-Layah-Gamma-Report": encodeReportHeader(
              summariseReport(result.validation, {
                generationId: result.metrics.generationId,
                creditsDeducted: result.metrics.creditsDeducted,
                resumed: result.metrics.resumed,
              }),
            ),
            "Access-Control-Expose-Headers": "X-Layah-PPT-Provider, X-Layah-Gamma-Validation, X-Layah-Gamma-Report, X-Layah-PPT-Visual-Validation",
          },
        });
      }
      if (body.pptProvider === "gamma") {
        console.warn(`[pptx export] gamma requested but not allowed (${choice.reason}); using legacy renderer`);
      }
    }

    const fromClient = slideUrlsFromRequestBody(body.pptSlideImageUrls, deck.length);
    const slideContentByIndex = deck.map((slide) =>
      `${slide.slideTitle}. ${slide.body}`.replace(/\s+/g, " ").trim(),
    );
    const slideTitleByIndex = deck.map((slide) => slide.slideTitle);

    let slideImageUrls: (string | null)[];
    let imageDiagnostics: SlideImageDiagnostic[] = [];
    if (fromClient !== null) {
      console.log("[pptx export] embedding pre-generated slide images (no new API image calls)");
      slideImageUrls = fromClient;
      const repairIndices = requiredImageRepairIndices(slideImageUrls);
      if (repairIndices.length) {
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
          requestedDeckIndices: repairIndices,
        });
        imageDiagnostics = repaired.diagnostics ?? [];
        slideImageUrls = slideImageUrls.map((url, idx) =>
          repairIndices.includes(idx)
            ? repaired.urls[idx] ?? url
            : url,
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
        imageDiagnostics = generated.diagnostics ?? [];
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

    const visualIntents = buildRequiredVisualIntents({ deck, topic, subject, grade, curriculumFramework })
      .map((intent) => {
        const diagnostic = imageDiagnostics.find((item) => item.deckIndex === intent.deckIndex);
        if (diagnostic?.resolvedProvider !== "none" && diagnostic?.resolvedImageReference) {
          return {
            ...intent,
            imageSource: diagnostic.resolvedProvider,
            assetStatus: "resolved" as const,
            resolvedImageReference: diagnostic.resolvedImageReference,
          };
        }
        if (slideImageUrls[intent.deckIndex]) {
          return { ...intent, imageSource: "cached" as const, assetStatus: "provider-generated-unverified" as const };
        }
        return { ...intent, imageSource: "none" as const, assetStatus: "missing" as const };
      });
    let visualCoverage: RequiredVisualCoverageReport;
    let structuralValidation: "passed" | "failed" = "passed";
    try {
      const extracted = await extractPptx(buffer);
      const physicalSlides = buildCanonicalSlides({
        deck,
        lesson: { topic, subject, grade, ...(chapter ? { chapter } : {}) },
        hasImage: (deckIdx) => Boolean(slideImageUrls[deckIdx]),
      });
      visualCoverage = verifyRequiredVisualCoverage({ intents: visualIntents, physicalSlides, actualSlides: extracted.slides });
    } catch (verificationError) {
      structuralValidation = "failed";
      console.error("[pptx export] required-visual verification could not inspect the PPTX", verificationError);
      visualCoverage = {
        verdict: "failed",
        categories: visualIntents.map((intent) => ({
          category: intent.category,
          deckIndex: intent.deckIndex,
          physicalSlides: [],
          pictureCount: 0,
          status: "missing",
          reason: "The exported PPTX could not be inspected for required visuals.",
        })),
        reasons: ["PPTX visual verification unavailable"],
      };
    }
    const visualHeader = encodeURIComponent(JSON.stringify({
      verdict: visualCoverage.verdict,
      missing: visualCoverage.categories.filter((item) => item.status === "missing").map((item) => item.category),
      unverified: visualCoverage.categories.filter((item) => item.status === "unverified").map((item) => item.category),
    }));

    const name = sanitizeExportFileName(`${grade}-${subject}-${topic}-ppt`) || "ppt-content";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}.pptx"`,
        "Cache-Control": "no-store",
        "X-Layah-PPT-Content-Validation": "preserved-by-platform-renderer",
        "X-Layah-PPT-Visual-Validation": visualCoverage.verdict,
        "X-Layah-PPT-Visual-Report": visualHeader,
        "X-Layah-PPT-Structural-Validation": structuralValidation,
        "X-Layah-PPT-Layout-Validation": "unverified",
      },
    });
  } catch (e) {
    if (e instanceof UploadedTemplateError) {
      return NextResponse.json({ code: e.code, error: e.message, slide: e.slide }, { status: e.status });
    }
    if (e instanceof GammaError) {
      // The technical message (credits, hosts, ledger state) is for logs; teachers get plain language.
      console.error("[pptx export] gamma", e.code, e.message);
      const friendly = gammaUserMessage(e.code);
      return NextResponse.json({ code: `GAMMA_${e.code.toUpperCase()}`, error: friendly.message, resumable: friendly.resumable }, { status: GAMMA_ERROR_STATUS[e.code] });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pptx export]", message, e);
    return NextResponse.json({ error: "We couldn't create your PowerPoint. Please try again." }, { status: 500 });
  }
}
