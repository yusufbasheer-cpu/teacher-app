"use client";

import { useEffect, useState } from "react";
import { getPptSourceLessonText, getPptSourceSlideOutline, type LessonPlanResult } from "@/lib/lesson-plan";
import { AFL_PHASE_IDS, type AflSelectionsPayload } from "@/lib/afl-tools";
import type { TemplateId as PptThemeId } from "@/lib/ppt-template-config";
import type { PresentationLanguage } from "@/lib/ppt-language";
import { getAuthHeaders } from "@/lib/auth-headers";
import { decodeReportHeader, type GammaReportSummary } from "@/lib/gamma/report";
import type { CuratedGammaTheme } from "@/lib/gamma/themes";

export type GammaThemeLoadState = "idle" | "loading" | "ready" | "empty" | "error";

/** The teacher's slide-design choices. Owned by the generator (chosen before generating) or by the viewer. */
export type GammaDesign = {
  available: boolean;
  useGamma: boolean;
  setUseGamma: (v: boolean) => void;
  themes: CuratedGammaTheme[];
  themeLoadState: GammaThemeLoadState;
  themeId: string;
  setThemeId: (id: string) => void;
  imageSource: string;
  setImageSource: (v: string) => void;
  imageStyle: string;
  setImageStyle: (v: string) => void;
};

const THEME_STORAGE_KEY = "layah:gamma-theme-id";

/**
 * Loads Gamma availability (the server is the authority) and the theme list. `enabled: false` skips all requests,
 * for a viewer that receives the generator's design instead.
 */
export function useGammaDesign(enabled = true): GammaDesign {
  const experiment = process.env.NEXT_PUBLIC_GAMMA_EXPERIMENT === "true";
  const [available, setAvailable] = useState(false);
  const [useGamma, setUseGamma] = useState(false);
  const [themes, setThemes] = useState<CuratedGammaTheme[]>([]);
  const [themeLoadState, setThemeLoadState] = useState<GammaThemeLoadState>("idle");
  const [themeId, setThemeIdState] = useState("");
  const [imageSource, setImageSource] = useState("aiGenerated");
  const [imageStyle, setImageStyle] = useState("clean educational illustration, age-appropriate, uncluttered");

  useEffect(() => {
    if (!experiment || !enabled) return;
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/lesson-plan/export/pptx", { headers: await getAuthHeaders(), cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { gammaAvailable?: boolean; defaultProvider?: string };
        if (!live) return;
        setAvailable(result.gammaAvailable === true);
        setUseGamma(result.gammaAvailable === true && result.defaultProvider === "gamma");
        if (result.gammaAvailable !== true) return;
        setThemeLoadState("loading");
        const themesResponse = await fetch("/api/lesson-plan/export/pptx/themes", { headers: await getAuthHeaders(), cache: "no-store" });
        if (!themesResponse.ok) {
          if (live) setThemeLoadState("error");
          return;
        }
        const list = ((await themesResponse.json()) as { themes?: CuratedGammaTheme[] }).themes ?? [];
        if (!live) return;
        setThemes(list);
        setThemeLoadState(list.length > 0 ? "ready" : "empty");
        let saved: string | null = null;
        try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* storage blocked */ }
        setThemeIdState(list.some((t) => t.id === saved) ? saved! : list[0]?.id ?? "");
      } catch {
        if (live) setThemeLoadState("error");
      }
    })();
    return () => { live = false; };
  }, [experiment, enabled]);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, id); } catch { /* storage blocked */ }
  };

  return { available, useGamma, setUseGamma, themes, themeLoadState, themeId, setThemeId, imageSource, setImageSource, imageStyle, setImageStyle };
}

function hasAflSelections(s: AflSelectionsPayload | undefined): boolean {
  return !!s && AFL_PHASE_IDS.some((p) => (s[p]?.length ?? 0) > 0);
}

export type PptExportInput = {
  lessonPlan: LessonPlanResult;
  subject: string;
  grade: string;
  topic: string;
  chapter?: string;
  language?: PresentationLanguage;
  learningObjectives?: string;
  teacherName?: string;
  pptThemeId: PptThemeId;
  curriculumFramework?: string;
  aflSelections?: AflSelectionsPayload;
  templateMode: "layah" | "uploaded";
  /** Present only when the viewer knows the Gamma gate result (otherwise the server default applies). */
  provider?: "gamma" | "legacy";
  design?: Pick<GammaDesign, "themeId" | "imageSource" | "imageStyle">;
  pptSlideImageUrls?: (string | null)[];
};

/**
 * The one place the PPT export body is built. The generator (building the deck during the loader) and the viewer
 * (download + stored-deck lookup) must send the same lesson inputs, or the server's request hash differs and a
 * deck that was already paid for is not found again.
 */
export function buildPptExportBody(p: PptExportInput): Record<string, unknown> {
  const gamma = p.provider === "gamma" && p.templateMode === "layah" && p.design;
  return {
    subject: p.subject,
    grade: p.grade,
    topic: p.topic,
    ...(p.chapter?.trim() ? { chapter: p.chapter.trim() } : {}),
    ...(p.language ? { language: p.language } : {}),
    pptContent: getPptSourceSlideOutline(p.lessonPlan),
    fullLessonPlan: getPptSourceLessonText(p.lessonPlan),
    learningObjectives: p.learningObjectives?.trim() || "",
    homeworkTask: typeof p.lessonPlan["Homework Task"] === "string" ? p.lessonPlan["Homework Task"].trim() : "",
    teacherName: p.teacherName?.trim() || "",
    pptTheme: p.pptThemeId,
    templateMode: p.templateMode,
    ...(p.provider && p.templateMode === "layah" ? { pptProvider: p.provider } : {}),
    ...(gamma ? {
      ...(p.design!.themeId ? { gammaThemeId: p.design!.themeId } : {}),
      gammaImageSource: p.design!.imageSource,
      ...(p.design!.imageSource === "aiGenerated" && p.design!.imageStyle ? { gammaImageStyle: p.design!.imageStyle } : {}),
    } : {}),
    curriculumFramework: p.curriculumFramework?.trim() ?? "",
    ...(hasAflSelections(p.aflSelections) ? { aflSelections: p.aflSelections } : {}),
    // Gamma never receives the platform slide images: it designs its own, and paginating the canonical deck as the
    // platform does without pictures keeps every Gamma request (prebuild, lookup, download) hashing the same.
    ...(p.pptSlideImageUrls && !gamma ? { pptSlideImageUrls: p.pptSlideImageUrls } : {}),
  };
}

export type GammaPptOutcome =
  | { kind: "ready"; blob: Blob; filename: string; summary: GammaReportSummary | null }
  | { kind: "error"; code: string; message: string };

/** Silent resumes of a long-running design before giving up (each resume is free: same generation id). */
export const GAMMA_MAX_RESUMES = 4;

/** Builds the Gamma deck, quietly resuming when a request outlasts the server's time limit. Never throws. */
export async function requestGammaPpt(
  body: Record<string, unknown>,
  filename: string,
  onResume?: (attempt: number) => void,
): Promise<GammaPptOutcome> {
  try {
    let res: Response | null = null;
    for (let attempt = 0; attempt <= GAMMA_MAX_RESUMES; attempt++) {
      if (attempt > 0) onResume?.(attempt);
      res = await fetch("/api/lesson-plan/export/pptx", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) break;
      const peek = (await res.clone().json().catch(() => null)) as { resumable?: boolean } | null;
      if (peek?.resumable !== true) break;
    }
    if (!res) throw new Error("no response");
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      return { kind: "error", code: j.code ?? `HTTP_${res.status}`, message: j.error ?? "We couldn't design your slides this time. Please try again." };
    }
    const blob = await res.blob();
    if (blob.size === 0 || res.headers.get("x-layah-ppt-provider") !== "gamma") {
      return { kind: "error", code: "EMPTY", message: "We couldn't design your slides this time. Please try again." };
    }
    return { kind: "ready", blob, filename, summary: decodeReportHeader(res.headers.get("x-layah-gamma-report")) };
  } catch (e) {
    console.error("[gamma-ppt] request failed", e);
    return { kind: "error", code: "NETWORK", message: "We couldn't reach the slide designer. Check your connection and try again." };
  }
}
