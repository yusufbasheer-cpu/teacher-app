"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getLessonPlanDisplayOrder,
  getSectionTabLabel,
  hasWorksheetForPdf,
  isLegacyLessonPlan,
  type LessonPlanResult,
} from "@/lib/lesson-plan";

type TeacherPackageViewerProps = {
  lessonPlan: LessonPlanResult;
  onDownloadAllPptx: () => void;
  pptxLoading: boolean;
  onDownloadWorksheetPdf: () => void;
  pdfLoading: boolean;
};

export function TeacherPackageViewer({
  lessonPlan,
  onDownloadAllPptx,
  pptxLoading,
  onDownloadWorksheetPdf,
  pdfLoading,
}: TeacherPackageViewerProps) {
  const sectionKeys = useMemo(() => getLessonPlanDisplayOrder(lessonPlan), [lessonPlan]);
  const [activeKey, setActiveKey] = useState(sectionKeys[0] ?? "");

  useEffect(() => {
    const keys = getLessonPlanDisplayOrder(lessonPlan);
    setActiveKey((prev) => (keys.includes(prev) ? prev : keys[0] ?? ""));
  }, [lessonPlan]);

  const activeContent = activeKey ? (lessonPlan[activeKey] ?? "") : "";
  const worksheetReady = hasWorksheetForPdf(lessonPlan);
  const legacyPlan = isLegacyLessonPlan(lessonPlan);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={onDownloadAllPptx}
          disabled={pptxLoading}
          className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pptxLoading ? "Building PowerPoint…" : "Download All as PowerPoint"}
        </button>
        <button
          type="button"
          onClick={onDownloadWorksheetPdf}
          disabled={pdfLoading || !worksheetReady}
          title={
            !worksheetReady
              ? legacyPlan
                ? "Worksheet PDF is available for new teacher packages that include a Worksheet section."
                : "Generate a package that includes worksheet content first."
              : "Download the Worksheet section as a PDF"
          }
          className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pdfLoading ? "Building PDF…" : "Download Worksheet as PDF"}
        </button>
      </div>

      {!worksheetReady && legacyPlan ? (
        <p className="text-xs text-slate-500">
          Worksheet PDF applies to the six-part teacher package. Older saved plans use the
          previous section layout without a dedicated worksheet field.
        </p>
      ) : null}

      <div className="overflow-x-auto pb-1">
        <div
          className="flex min-w-0 gap-2 border-b border-blue-100 pb-3"
          role="tablist"
          aria-label="Teacher package sections"
        >
          {sectionKeys.map((key) => {
            const selected = key === activeKey;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveKey(key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  selected
                    ? "bg-blue-700 text-white shadow-md"
                    : "border border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
                }`}
              >
                {getSectionTabLabel(key)}
              </button>
            );
          })}
        </div>
      </div>

      <article
        className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-5 shadow-sm md:p-6"
        role="tabpanel"
        aria-labelledby={activeKey ? `tab-${activeKey}` : undefined}
      >
        <div className="flex flex-col gap-1 border-b border-blue-100 pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 id={activeKey ? `tab-${activeKey}` : undefined} className="text-lg font-bold text-slate-900">
              {activeKey ? getSectionTabLabel(activeKey) : "Section"}
            </h4>
            {activeKey ? (
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-blue-700">
                {activeKey}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 max-h-[min(70vh,780px)] overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 shadow-inner md:p-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
            {activeContent}
          </pre>
        </div>
      </article>
    </div>
  );
}
