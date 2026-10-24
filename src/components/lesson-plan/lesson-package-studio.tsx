"use client";

import { useMemo } from "react";
import { GenerationStudio, type StudioOutcome } from "@/components/generation-studio/generation-studio";
import { ArtifactPagesPreview, SlideDeckPreview } from "@/components/generation-studio/studio-previews";
import { lessonPackageStages, slideTextFromOutline } from "@/components/generation-studio/lesson-package-stages";
import type { GammaPptOutcome } from "@/components/lesson-plan/gamma-ppt";
import { presentVerdict } from "@/lib/gamma/report";
import { getStructuredLessonSlideTitles } from "@/lib/ppt-structured-lesson";
import { SECTION_TAB_LABELS, type LessonPlanResult } from "@/lib/lesson-plan";

type LessonPackageStudioProps = {
  sections: readonly string[];
  progress: string | null;
  lessonPlan: LessonPlanResult | null;
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
  onDownload: (blob: Blob, filename: string) => void;
  onOpenLesson: () => void;
};

export function LessonPackageStudio(p: LessonPackageStudioProps) {
  const pptSelected = p.sections.includes("PPT Slide Content");
  const contentReady = p.lessonPlan !== null;
  const verdict = p.gamma?.outcome?.kind === "ready" ? presentVerdict(p.gamma.outcome.summary) : null;

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
  });

  const titles = useMemo(() => getStructuredLessonSlideTitles(p.arabicSlides, p.uaeFramework), [p.arabicSlides, p.uaeFramework]);
  const outline = p.lessonPlan?.["PPT Slide Content"];
  const slides = useMemo(
    () => (typeof outline === "string" && outline.trim() ? slideTextFromOutline(outline, titles) : titles.map((title) => ({ title, lines: [] as string[] }))),
    [outline, titles],
  );

  const eyebrow = [p.subject, p.grade && `Grade ${p.grade.replace(/^grade\s*/i, "")}`].filter(Boolean).join(" · ");
  const designing = Boolean(p.gamma && !p.gamma.outcome && contentReady);
  const actualSlides = verdict && p.gamma?.outcome?.kind === "ready" ? p.gamma.outcome.summary?.counts.actualSlides : undefined;

  const caption = !contentReady
    ? `Lesson structure · ${titles.length} slides · text appears here once it's written`
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
    />
  ) : (
    <ArtifactPagesPreview
      caption={contentReady ? "Your teaching resources are written" : "The resources in this package · placeholders until they're written"}
      pages={p.sections.map((k) => ({ key: k, title: SECTION_TAB_LABELS[k] ?? k, status: contentReady ? "done" : "active" }))}
    />
  );

  const meta = [
    ...(p.gamma?.themeName ? [{ label: "Slide theme", value: p.gamma.themeName }] : []),
    ...(pptSelected ? [{ label: actualSlides ? "Designed slides" : "Lesson slides", value: String(actualSlides ?? titles.length) }] : []),
    ...(!pptSelected ? [{ label: "Resources", value: String(p.sections.length) }] : []),
  ];

  let outcome: StudioOutcome | null = null;
  if (p.finished) {
    const open = { label: "Open your lesson", onClick: p.onOpenLesson };
    const o = p.gamma?.outcome;
    if (o?.kind === "ready" && verdict) {
      const s = o.summary;
      const notes = s && s.verdict !== "passed" ? (s.examples.length ? s.examples : s.reasons).slice(0, 4) : undefined;
      // A deck that failed the content check is never offered as classroom-ready: the lesson comes first and the
      // file is only the explicitly labelled "Download anyway" for checking.
      outcome = verdict.normalDownload
        ? {
            tone: verdict.tone,
            title: verdict.tone === "ok" ? "Presentation ready" : verdict.title,
            // presentVerdict's copy assumes the file already downloaded; here it hasn't yet.
            detail: verdict.tone === "ok" ? `${s?.counts.actualSlides ?? "Your"} slides, designed by Gamma, with your lesson wording checked on every slide.` : verdict.detail,
            notes,
            actions: [
              { label: "Download PowerPoint", onClick: () => { p.onDownload(o.blob, o.filename); p.onOpenLesson(); } },
              { ...open, variant: "outline" },
            ],
          }
        : {
            tone: "bad",
            title: verdict.title,
            detail: `${verdict.detail} Your lesson itself is ready.`,
            notes,
            actions: [open, { label: verdict.downloadLabel, variant: "ghost", onClick: () => p.onDownload(o.blob, o.filename) }],
          };
    } else if (o?.kind === "error") {
      outcome = {
        tone: "warn",
        title: "Your lesson is ready — the slide design didn't finish",
        detail: `${o.message} You can design the PowerPoint again from your lesson.`,
        actions: [open],
      };
    } else {
      outcome = { tone: "ok", title: "Your lesson package is ready", detail: "Opening it now.", actions: [open] };
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
