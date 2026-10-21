"use client";

import { Check, LoaderCircle, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type LoadingGamePreset = "lesson-plan" | "question-paper";

export const QUESTION_PAPER_LOADING_SECTIONS = [
  { key: "paper", sectionKey: "qp-paper", label: "Question paper" },
  { key: "blueprint", sectionKey: "qp-blueprint", label: "Blueprint" },
  { key: "downloads", sectionKey: "qp-downloads", label: "Downloadable files" },
];

const PRESENTATION_STAGES = [
  "Preparing lesson content",
  "Building your slides",
  "Checking presentation quality",
  "Preparing your download",
] as const;

export function presentationStageForStatus(statusText?: string | null): number {
  const status = (statusText ?? "").toLowerCase();
  if (/finaliz|prepar.*download/.test(status)) return 3;
  if (/visual|illustration|image|checking/.test(status)) return 2;
  if (/slide/.test(status)) return 1;
  return 0;
}

/** Status text comes from generation; no timers imply completed work. */
export function LessonPlanLoadingGame({ active, statusText, selectedSections, preset = "lesson-plan" }: {
  active: boolean;
  statusText?: string | null;
  selectedSections?: Record<string, boolean> | null;
  preset?: LoadingGamePreset;
}) {
  const selected = Object.entries(selectedSections ?? {}).filter(([, included]) => included);
  const labels = preset === "question-paper"
    ? QUESTION_PAPER_LOADING_SECTIONS.filter((item) => selectedSections?.[item.sectionKey]).map((item) => item.label)
    : selected.map(([key]) => key === "PPT Slide Content" ? "Presentation" : key);
  const includesPresentation = preset === "lesson-plan" && Boolean(selectedSections?.["PPT Slide Content"]);
  const activeStage = presentationStageForStatus(statusText);
  return (
    <Dialog open={active}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-subtle text-brand-text"><LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden /></div>
        <DialogTitle className="text-xl font-semibold">Preparing your {preset === "question-paper" ? "question paper" : "lesson package"}</DialogTitle>
        <DialogDescription>Keep this page open while your materials are generated. Your results will appear here when ready.</DialogDescription>
        <div role="status" aria-live="polite" className="rounded-lg border border-brand-border bg-brand-subtle p-4">
          <p className="text-sm font-semibold text-brand-text">{includesPresentation ? PRESENTATION_STAGES[activeStage] : statusText || "Starting generation..."}</p>
          {includesPresentation && statusText ? <p className="mt-1 text-xs text-muted">{statusText}</p> : null}
        </div>
        {includesPresentation ? (
          <ol aria-label="Presentation generation progress" className="grid gap-2 sm:grid-cols-2">
            {PRESENTATION_STAGES.map((label, index) => {
              const complete = index < activeStage;
              const current = index === activeStage;
              return <li key={label} aria-current={current ? "step" : undefined} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${current ? "bg-brand-subtle font-semibold text-brand-text" : "text-muted"}`}>
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${complete ? "border-brand bg-brand text-white" : current ? "border-brand text-brand-text" : "border-line text-faint"}`} aria-hidden>{complete ? <Check className="size-3" /> : index + 1}</span>
                {label}
              </li>;
            })}
          </ol>
        ) : null}
        {labels.length > 0 ? <div><p className="mb-3 text-sm text-faint">Included in this request</p><ul className="grid gap-3 sm:grid-cols-2">{labels.map((label) => <li key={label} className="flex items-center gap-2 text-sm text-muted"><FileText className="size-4 shrink-0 text-faint" aria-hidden />{label}</li>)}</ul></div> : null}
      </DialogContent>
    </Dialog>
  );
}
