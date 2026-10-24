"use client";

import { useMemo } from "react";
import { GenerationStudio, type StudioAction, type StudioOutcome } from "@/components/generation-studio/generation-studio";
import { ArtifactPagesPreview, SlideDeckPreview } from "@/components/generation-studio/studio-previews";
import { lessonPackageStages, previewLinesFromComponent, slideTextFromOutline } from "@/components/generation-studio/lesson-package-stages";
import type { GammaPptOutcome } from "@/components/lesson-plan/gamma-ppt";
import { PACKAGE_DOCX_FILES, type ReadyFiles } from "@/components/lesson-plan/package-files";
import { presentVerdict } from "@/lib/gamma/report";
import { getStructuredLessonSlideTitles } from "@/lib/ppt-structured-lesson";
import { SECTION_TAB_LABELS, type LessonPlanResult } from "@/lib/lesson-plan";

type LessonPackageStudioProps = {
  sections: readonly string[];
  progress: string | null;
  lessonPlan: LessonPlanResult | null;
  livePptComponents: Record<number, string>;
  /** The component whose text arrived last (1-based), so the large preview can show it being written. */
  latestPptComponent: number | null;
  subject: string;
  grade: string;
  topicTitle: string;
  arabicSlides: boolean;
  uaeFramework: boolean;
  /** Present when the teacher chose a Gamma design before generating. */
  gamma: null | {
    themeName?: string;
    swatch?: string[];
    designing: boolean;
    resumes: number;
    outcome: GammaPptOutcome | null;
  };
  finished: boolean;
  /** The download files being built, then ready (all in memory, so every click is instant). */
  preparingFiles: boolean;
  readyFiles: ReadyFiles | null;
  onDownload: (blob: Blob, filename: string) => void;
  onOpenLesson: () => void;
};

export function LessonPackageStudio(p: LessonPackageStudioProps) {
  const pptSelected = p.sections.includes("PPT Slide Content");
  const contentReady = p.lessonPlan !== null;
  const deck = p.gamma?.outcome?.kind === "ready" ? p.gamma.outcome : null;
  const verdict = deck ? presentVerdict(deck.summary) : null;

  const stages = lessonPackageStages({
    sections: p.sections,
    progress: p.progress,
    contentReady,
    gamma: p.gamma
      ? {
          phase: p.gamma.outcome ? (p.gamma.outcome.kind === "ready" ? "done" : "error") : p.gamma.designing ? "designing" : "pending",
          resumes: p.gamma.resumes,
          verdict: verdict ? { tone: verdict.tone, title: verdict.title } : null,
          errorMessage: p.gamma.outcome?.kind === "error" ? p.gamma.outcome.message : undefined,
        }
      : null,
    files: p.readyFiles ? "done" : p.preparingFiles ? "active" : "pending",
  });

  const titles = useMemo(() => getStructuredLessonSlideTitles(p.arabicSlides, p.uaeFramework), [p.arabicSlides, p.uaeFramework]);
  const outline = p.lessonPlan?.["PPT Slide Content"];
  const componentSlides = useMemo(() => {
    if (typeof outline === "string" && outline.trim()) return slideTextFromOutline(outline, titles);
    return titles.map((title, index) => ({ title, lines: previewLinesFromComponent(p.livePptComponents[index + 1] ?? "") }));
  }, [outline, p.livePptComponents, titles]);
  const slides = deck?.slidePreviews.length ? deck.slidePreviews : componentSlides;

  const eyebrow = [p.subject, p.grade && `Grade ${p.grade.replace(/^grade\s*/i, "")}`].filter(Boolean).join(" · ");
  const designing = Boolean(p.gamma && !p.gamma.outcome && contentReady);
  const actualSlides = deck?.summary?.counts.actualSlides;

  const caption = !contentReady
      ? `Lesson structure · ${titles.length} components · live text appears as each component is written`
    : designing
      ? `Your slide text${p.gamma?.themeName ? ` in ${p.gamma.themeName} colours` : ""} · this is a preview, Gamma is designing the real layout`
      : actualSlides
        ? `Your slide text · the designed PowerPoint has ${actualSlides} slides`
        : "Your slide text · preview";

  const preview = pptSelected ? (
    <SlideDeckPreview
      eyebrow={eyebrow}
      deckTitle={p.topicTitle}
      slides={slides}
      swatch={p.gamma && contentReady ? p.gamma.swatch : undefined}
      caption={caption}
      busy={!p.finished}
      focusIndex={!contentReady && p.latestPptComponent ? p.latestPptComponent - 1 : undefined}
    />
  ) : (
    <ArtifactPagesPreview
      caption={contentReady ? "Your teaching resources are written" : "The resources in this package · placeholders until they're written"}
      pages={p.sections.map((k) => ({ key: k, title: SECTION_TAB_LABELS[k] ?? k, status: contentReady ? "done" : "active" }))}
    />
  );

  const meta = [
    ...(p.gamma?.themeName ? [{ label: "Slide theme", value: p.gamma.themeName }] : []),
    ...(pptSelected ? [{ label: actualSlides ? "Physical slides" : "Lesson components", value: String(actualSlides ?? titles.length) }] : []),
    ...(!pptSelected ? [{ label: "Resources", value: String(p.sections.length) }] : []),
  ];

  let outcome: StudioOutcome | null = null;
  if (p.finished) {
    const open: StudioAction = { label: "Open your lesson", onClick: p.onOpenLesson, variant: "outline" };
    const all = p.readyFiles?.all;
    const docx = PACKAGE_DOCX_FILES.flatMap(({ key }) => (p.readyFiles?.[key] ? [p.readyFiles[key]!] : []));
    const download = (f: { blob: Blob; filename: string }) => () => p.onDownload(f.blob, f.filename);
    const actions: StudioAction[] = [
      ...(all ? [{ label: "Download all", onClick: download(all) }] : []),
      ...(deck ? [{ label: "Download PowerPoint", onClick: download(deck), variant: all ? ("outline" as const) : undefined }] : []),
      open,
    ];
    // With a single file there's nothing to pick between: "Download all" already covers it.
    const files = docx.length + (deck ? 1 : 0) > 1
      ? [
          ...(deck ? [{ label: "PowerPoint", type: "PPTX", onClick: download(deck) }] : []),
          ...docx.map((f) => ({ label: f.label, type: "DOCX", onClick: download(f) })),
        ]
      : undefined;

    const o = p.gamma?.outcome;
    if (deck && verdict) {
      outcome = {
        tone: verdict.tone,
        title: verdict.tone === "bad" ? verdict.title : verdict.tone === "ok" ? "Presentation ready" : verdict.title,
        // presentVerdict's copy assumes the file already downloaded; here it hasn't yet.
        detail: verdict.tone === "ok" ? `${actualSlides ?? "Your"} slides, designed by Gamma, plus every file in your lesson package.` : verdict.detail,
        actions,
        files,
      };
    } else if (o?.kind === "error") {
      outcome = {
        tone: "warn",
        title: "Your lesson is ready — the slide design didn't finish",
        detail: `${o.message} You can design the PowerPoint again from your lesson.${all ? " Download all includes the standard Layah slides." : ""}`,
        actions,
        files,
      };
    } else {
      outcome = { tone: "ok", title: "Your lesson package is ready", detail: "Every file is ready to download.", actions, files };
    }
  }

  return (
    <GenerationStudio
      kind={p.gamma ? "Presentation" : "Teaching package"}
      eyebrow={eyebrow}
      title={p.gamma ? `Creating your ${p.subject || "lesson"} presentation` : `Building your ${p.subject || "lesson"} package`}
      subtitle={p.topicTitle}
      stages={stages}
      meta={meta}
      preview={preview}
      outcome={outcome}
      footerNote={designing ? "Keep this page open — your designed PowerPoint arrives here." : "Keep this page open while Layah writes your lesson."}
    />
  );
}
