"use client";

import { LoaderCircle, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type LoadingGamePreset = "lesson-plan" | "question-paper";

export const QUESTION_PAPER_LOADING_SECTIONS = [
  { key: "paper", sectionKey: "qp-paper", label: "Question paper" },
  { key: "blueprint", sectionKey: "qp-blueprint", label: "Blueprint" },
  { key: "downloads", sectionKey: "qp-downloads", label: "Downloadable files" },
];

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
  return (
    <Dialog open={active}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-subtle text-brand-text"><LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden /></div>
        <DialogTitle className="text-xl font-semibold">Preparing your {preset === "question-paper" ? "question paper" : "lesson package"}</DialogTitle>
        <DialogDescription>Keep this page open while your materials are generated. Your results will appear here when ready.</DialogDescription>
        <p role="status" aria-live="polite" className="rounded-lg border border-line bg-sunken p-4 text-sm font-medium text-ink">{statusText || "Starting generation..."}</p>
        {labels.length > 0 ? <div><p className="mb-3 text-sm text-faint">Included in this request</p><ul className="grid gap-3 sm:grid-cols-2">{labels.map((label) => <li key={label} className="flex items-center gap-2 text-sm text-muted"><FileText className="size-4 shrink-0 text-faint" aria-hidden />{label}</li>)}</ul></div> : null}
      </DialogContent>
    </Dialog>
  );
}
