"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getLessonPlanDisplayOrder,
  getSectionTabLabel,
  hasTeacherPackageContent,
  type LessonPlanResult,
  type SectionImageMap,
  type TeacherPackageSectionKey,
} from "@/lib/lesson-plan";

type TeacherPackageViewerProps = {
  lessonPlan: LessonPlanResult;
  /** FLUX.1 image URLs from fal.ai, keyed by teacher-package section title. */
  sectionImages?: SectionImageMap;
  /** Per-section fal.ai failures (exact messages). */
  sectionImageErrors?: Partial<Record<TeacherPackageSectionKey, string>>;
  subject: string;
  grade: string;
  topic: string;
  /** When set, PPT slide images use the same framework hint as generation. */
  curriculumFramework?: string;
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

function hasSectionContent(plan: LessonPlanResult, key: string): boolean {
  const v = plan[key];
  return typeof v === "string" && v.trim().length > 0;
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
  sectionImages,
  sectionImageErrors,
  subject,
  grade,
  topic,
  curriculumFramework,
}: TeacherPackageViewerProps) {
  const sectionKeys = useMemo(() => getLessonPlanDisplayOrder(lessonPlan), [lessonPlan]);
  const [activeKey, setActiveKey] = useState(sectionKeys[0] ?? "");
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const showTeacherDownloads = hasTeacherPackageContent(lessonPlan);
  const hasPpt = hasSectionContent(lessonPlan, "PPT Slide Content");
  const hasLesson = hasSectionContent(lessonPlan, "Full Lesson Plan");
  const hasWorksheet = hasSectionContent(lessonPlan, "Worksheet");
  const hasAssessment = hasSectionContent(lessonPlan, "Assessment Questions");
  const hasHomework = hasSectionContent(lessonPlan, "Homework Task");
  const hasNotes = hasSectionContent(lessonPlan, "Teacher Notes");

  useEffect(() => {
    const keys = getLessonPlanDisplayOrder(lessonPlan);
    setActiveKey((prev) => (keys.includes(prev) ? prev : keys[0] ?? ""));
  }, [lessonPlan]);

  const activeContent = activeKey ? (lessonPlan[activeKey] ?? "") : "";
  const activeIllustrationUrls =
    activeKey && sectionImages?.[activeKey as keyof SectionImageMap];
  const activeImageList = Array.isArray(activeIllustrationUrls) ? activeIllustrationUrls : [];
  const activeImageError =
    activeKey && sectionImageErrors?.[activeKey as keyof typeof sectionImageErrors];

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

  const baseMeta = { subject, grade, topic };

  const onDownloadPpt = () =>
    runExport(
      "ppt",
      `${baseName}-ppt.pptx`,
      "/api/lesson-plan/export/pptx",
      {
        ...baseMeta,
        pptContent: lessonPlan["PPT Slide Content"] ?? "",
        ...(curriculumFramework?.trim()
          ? { curriculumFramework: curriculumFramework.trim() }
          : {}),
      },
    );

  const onDownloadLessonPlan = () =>
    runExport(
      "lesson",
      `${baseName}-lesson-plan.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
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
        ...baseMeta,
        documentTitle: "Teacher Notes",
        fileBaseName: "teacher-notes",
        content: lessonPlan["Teacher Notes"] ?? "",
      },
    );

  const onDownloadZip = () =>
    runExport("zip", `${baseName}-all.zip`, "/api/lesson-plan/export/zip", {
      ...baseMeta,
      lessonPlan,
    });

  return (
    <div className="space-y-5">
      {showTeacherDownloads ? (
        <>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Downloads
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hasPpt ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadPpt}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "ppt" ? "Building your PPT… please wait" : "Download PPT"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  PowerPoint with text plus an AI image per slide (requires FAL_API_KEY)
                </span>
              </button>
              ) : null}
              {hasLesson ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadLessonPlan}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "lesson" ? "Preparing…" : "Download Lesson Plan"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
              {hasWorksheet ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadWorksheet}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "worksheet" ? "Preparing…" : "Download Worksheet"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
              {hasAssessment ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadAssessment}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "assessment" ? "Preparing…" : "Download Assessment"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
              {hasHomework ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadHomework}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "homework" ? "Preparing…" : "Download Homework"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
              {hasNotes ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadTeacherNotes}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy === "notes" ? "Preparing…" : "Download Teacher Notes"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
            </div>
            {busy === "ppt" ? (
              <p className="mt-3 text-sm font-medium text-blue-900" role="status" aria-live="polite">
                Building your PPT… please wait
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy !== null}
              onClick={onDownloadZip}
              className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50 sm:w-auto"
            >
              {busy === "zip" ? "Building ZIP…" : "Download ZIP package"}
            </button>
            <p className="mt-1.5 text-xs text-slate-500">
              ZIP includes only the materials present in this package.
            </p>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          File downloads (PPT, Word, and ZIP) are available when your plan includes at least one
          teacher-package section (lesson plan, slides, worksheet, and so on). Legacy-format plans
          cannot be exported here — generate a new package to unlock downloads.
        </p>
      )}

      {exportError ? <p className="text-sm text-red-600">{exportError}</p> : null}

      {sectionImageErrors && Object.keys(sectionImageErrors).length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950"
        >
          <p className="font-semibold">Some section images failed (fal.ai)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 whitespace-pre-wrap">
            {(Object.entries(sectionImageErrors) as [TeacherPackageSectionKey, string][]).map(
              ([key, msg]) => (
                <li key={key}>
                  <span className="font-medium">{getSectionTabLabel(key)}:</span> {msg}
                </li>
              ),
            )}
          </ul>
        </div>
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

        <div className="mt-4 grid max-h-[min(70vh,780px)] gap-4 overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 shadow-inner lg:grid-cols-[1fr_min(280px,32%)] md:p-5">
          <div className="min-h-0 min-w-0 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
              {activeContent}
            </pre>
          </div>
          {activeImageList.length > 0 ? (
            <aside className="flex min-h-0 flex-col gap-3 border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Section illustration (FLUX.1)
              </p>
              <div className="space-y-3 overflow-y-auto">
                {activeImageList.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm ring-blue-500 transition hover:ring-2"
                  >
                    <img
                      src={src}
                      alt="Educational illustration generated for this section"
                      className="h-auto w-full object-contain"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </aside>
          ) : activeImageError ? (
            <aside className="border-t border-red-100 pt-4 text-xs text-red-800 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <p className="font-semibold">Image for this section failed</p>
              <p className="mt-1 whitespace-pre-wrap">{activeImageError}</p>
            </aside>
          ) : null}
        </div>
      </article>
    </div>
  );
}
