"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getLessonPlanDisplayOrder,
  getSectionTabLabel,
  isTeacherPackagePlan,
  type LessonPlanResult,
} from "@/lib/lesson-plan";

type TeacherPackageViewerProps = {
  lessonPlan: LessonPlanResult;
  subject: string;
  grade: string;
  topic: string;
};

type ExportKey =
  | "ppt"
  | "lesson"
  | "worksheet"
  | "assessment"
  | "homework"
  | "notes"
  | "zip";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilenamePart(value: string, fallback: string) {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

export function TeacherPackageViewer({
  lessonPlan,
  subject,
  grade,
  topic,
}: TeacherPackageViewerProps) {
  const sectionKeys = useMemo(() => getLessonPlanDisplayOrder(lessonPlan), [lessonPlan]);
  const [activeKey, setActiveKey] = useState(sectionKeys[0] ?? "");
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fullPackage = isTeacherPackagePlan(lessonPlan);

  useEffect(() => {
    const keys = getLessonPlanDisplayOrder(lessonPlan);
    setActiveKey((prev) => (keys.includes(prev) ? prev : keys[0] ?? ""));
  }, [lessonPlan]);

  const activeContent = activeKey ? (lessonPlan[activeKey] ?? "") : "";

  const baseName = safeFilenamePart(topic, "lesson");

  const runExport = async (key: ExportKey, filename: string, url: string, body: object) => {
    setExportError(null);
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Download failed.");
      }
      const blob = await res.blob();
      triggerDownload(blob, filename);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const meta = { subject, grade, topic };

  const onDownloadPpt = () =>
    runExport(
      "ppt",
      `${baseName}-ppt.pptx`,
      "/api/lesson-plan/export/pptx",
      { ...meta, pptContent: lessonPlan["PPT Slide Content"] ?? "" },
    );

  const onDownloadLessonPlan = () =>
    runExport(
      "lesson",
      `${baseName}-lesson-plan.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...meta,
        documentTitle: "Lesson Plan",
        fileBaseName: "lesson-plan",
        content: lessonPlan["Full Lesson Plan"] ?? "",
      },
    );

  const onDownloadWorksheet = () =>
    runExport(
      "worksheet",
      `${baseName}-worksheet.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...meta,
        documentTitle: "Worksheet",
        fileBaseName: "worksheet",
        content: lessonPlan["Worksheet"] ?? "",
      },
    );

  const onDownloadAssessment = () =>
    runExport(
      "assessment",
      `${baseName}-assessment.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...meta,
        documentTitle: "Assessment Questions",
        fileBaseName: "assessment",
        content: lessonPlan["Assessment Questions"] ?? "",
      },
    );

  const onDownloadHomework = () =>
    runExport(
      "homework",
      `${baseName}-homework.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...meta,
        documentTitle: "Homework",
        fileBaseName: "homework",
        content: lessonPlan["Homework Task"] ?? "",
      },
    );

  const onDownloadTeacherNotes = () =>
    runExport(
      "notes",
      `${baseName}-teacher-notes.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...meta,
        documentTitle: "Teacher Notes",
        fileBaseName: "teacher-notes",
        content: lessonPlan["Teacher Notes"] ?? "",
      },
    );

  const onDownloadZip = () =>
    runExport("zip", `${baseName}-all.zip`, "/api/lesson-plan/export/zip", {
      ...meta,
      lessonPlan,
    });

  return (
    <div className="space-y-5">
      {fullPackage ? (
        <>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Downloads
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadPpt}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "ppt" ? "Preparing…" : "Download PPT"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Multi-slide PowerPoint from PPT content
                </span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadLessonPlan}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "lesson" ? "Preparing…" : "Download Lesson Plan"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadWorksheet}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "worksheet" ? "Preparing…" : "Download Worksheet"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadAssessment}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "assessment" ? "Preparing…" : "Download Assessment"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadHomework}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "homework" ? "Preparing…" : "Download Homework"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadTeacherNotes}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "notes" ? "Preparing…" : "Download Teacher Notes"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={onDownloadZip}
              className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50 sm:w-auto"
            >
              {busy === "zip" ? "Building ZIP…" : "Download All as ZIP"}
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          File downloads (PPT, Word, and ZIP) are available for the full six-part teacher package.
          Generate a new plan to unlock exports, or open a saved plan that uses the new format.
        </p>
      )}

      {exportError ? <p className="text-sm text-red-600">{exportError}</p> : null}

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
      >
        <div className="flex flex-col gap-1 border-b border-blue-100 pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-lg font-bold text-slate-900">
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
