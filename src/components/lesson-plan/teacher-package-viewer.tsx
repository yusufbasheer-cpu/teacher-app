"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getLessonPlanDisplayOrder,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
  getSectionTabLabel,
  hasTeacherPackageContent,
  mergePptSlideImageUrlsIntoPlan,
  type LessonPlanResult,
  type SectionImageMap,
  type TeacherPackageSectionKey,
} from "@/lib/lesson-plan";
import { AFL_PHASE_IDS, type AflSelectionsPayload } from "@/lib/afl-tools";
import { DEFAULT_PPT_THEME_ID, type PptThemeId } from "@/lib/ppt-themes";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";

function hasAflSelections(s: AflSelectionsPayload | undefined): boolean {
  if (!s) return false;
  return AFL_PHASE_IDS.some((p) => (s[p]?.length ?? 0) > 0);
}

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
  /** PowerPoint color theme from the generator; defaults to Ocean Blue. */
  pptThemeId?: PptThemeId;
  /** Shown on title slide and sent to export API. */
  teacherName?: string;
  /** Learning objectives line from the generator form (enriches PPT objectives slide). */
  learningObjectives?: string;
  /** Teacher-selected AFL tools from the generator (PPT + lesson plan exports). */
  aflSelections?: AflSelectionsPayload;
  /** Pre-generated PPT slide URLs from lesson generation (embedded at download time). */
  pptSlideImageUrls?: (string | null)[] | null;
};

type ExportKey =
  | "ppt"
  | "lesson"
  | "worksheet"
  | "assessment"
  | "homework"
  | "notes"
  | "afl-sheets"
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

// ── PPT export progress (visual only; images are usually pre-built during generation) ──
const TOTAL_IMAGES = 10;

const IMAGE_MILESTONES_FULL: { at: number; count: number; label: string }[] = [
  { at: 4, count: 1, label: "Title slide image (Pexels)" },
  { at: 8, count: 2, label: "Starter image (Pexels)" },
  { at: 12, count: 3, label: "UAE link image (Pexels)" },
  { at: 16, count: 4, label: "Plenary image (Pexels)" },
  { at: 20, count: 5, label: "Extended task image (Pexels)" },
  { at: 35, count: 6, label: "SDG / chapter illustration (fal.ai)" },
  { at: 50, count: 7, label: "Main phase diagram (fal.ai)" },
  { at: 65, count: 8, label: "Differentiated activity art (fal.ai)" },
  { at: 80, count: 9, label: "Exit ticket graphic (fal.ai)" },
  { at: 95, count: 10, label: "Success criteria graphic (fal.ai)" },
];

const TOTAL_ESTIMATE_FULL_S = 95;

const IMAGE_MILESTONES_PACKAGE: { at: number; count: number; label: string }[] = [
  { at: 5, count: 4, label: "Loading slide assets…" },
  { at: 12, count: 7, label: "Building slide layouts…" },
  { at: 20, count: 10, label: "Packaging PowerPoint file…" },
];

const TOTAL_ESTIMATE_PACKAGE_S = 22;

function PptImageProgressCard({
  active,
  packagingOnly,
}: {
  active: boolean;
  /** True when images were generated during lesson creation — export only packs the file. */
  packagingOnly: boolean;
}) {
  const milestones = packagingOnly ? IMAGE_MILESTONES_PACKAGE : IMAGE_MILESTONES_FULL;
  const totalEstimate = packagingOnly ? TOTAL_ESTIMATE_PACKAGE_S : TOTAL_ESTIMATE_FULL_S;
  const [elapsed, setElapsed]   = useState(0);
  const [imgCount, setImgCount] = useState(0);
  const [milestone, setMilestone] = useState("");
  const startRef = useRef<number | null>(null);
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      // Reset when download finishes
      setElapsed(0);
      setImgCount(0);
      setMilestone("");
      startRef.current = null;
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    startRef.current = Date.now();
    tickRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000);
      setElapsed(secs);

      // Find the latest milestone we have passed
      let latestCount = 0;
      let latestLabel = "";
      for (const m of milestones) {
        if (secs >= m.at) {
          latestCount = m.count;
          latestLabel = m.label;
        }
      }
      setImgCount(latestCount);
      setMilestone(latestLabel);
    }, 1000);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [active]);

  if (!active) return null;

  const remaining = Math.max(0, totalEstimate - elapsed);
  const allDone   = imgCount >= TOTAL_IMAGES;

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 14,
        border: "1px solid rgba(0,198,167,0.3)",
        background: "linear-gradient(135deg, #0A1628 0%, #112240 100%)",
        padding: "20px 24px",
        color: "#fff",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🎨</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
          {allDone ? "Almost ready…" : packagingOnly ? "Building your PowerPoint…" : "Preparing slide images…"}
        </span>
      </div>

      {/* Image count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            height: 8,
            flex: 1,
            borderRadius: 99,
            background: "rgba(255,255,255,0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(imgCount / TOTAL_IMAGES) * 100}%`,
              background: "linear-gradient(90deg,#00C6A7,#00e8c3)",
              borderRadius: 99,
              boxShadow: "0 0 8px rgba(0,198,167,0.6)",
              transition: "width 0.8s ease",
            }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#00C6A7", minWidth: 52, textAlign: "right" }}>
          {imgCount}/{TOTAL_IMAGES}
        </span>
      </div>

      {milestone ? (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
          ✔ {milestone}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
          Fetching photos and generating illustrations…
        </p>
      )}

      {/* Countdown */}
      {!allDone ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            Estimated time remaining:
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#00C6A7",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.5px",
            }}
          >
            {remaining}s
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#00C6A7" }}>
            0 seconds — all done!
          </span>
        </div>
      )}
    </div>
  );
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
  pptThemeId = DEFAULT_PPT_THEME_ID,
  teacherName,
  learningObjectives,
  aflSelections,
  pptSlideImageUrls,
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
  const hasAflSheets = hasSectionContent(lessonPlan, "AFL Activity Sheets");

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

  const runExport = async (
    key: ExportKey,
    filename: string,
    url: string,
    body: object,
    extraHeaders?: Record<string, string>,
  ) => {
    setExportError(null);
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const raw = await res.text();
        let msg = `Download failed (HTTP ${res.status}).`;
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error.trim();
        } catch {
          if (raw.trim()) msg = raw.trim().slice(0, 600);
        }
        throw new Error(msg);
      }

      const looksLikeBinary =
        contentType.includes("application/vnd") ||
        contentType.includes("application/zip") ||
        contentType.includes("application/octet-stream") ||
        contentType.includes("application/x-zip");

      if (!looksLikeBinary && contentType.includes("application/json")) {
        const raw = await res.text();
        try {
          const j = JSON.parse(raw) as { error?: string };
          throw new Error(j.error ?? "Server returned JSON instead of a file.");
        } catch (e) {
          if (e instanceof Error && e.message.includes("Server returned")) throw e;
          throw new Error("Unexpected response from download server.");
        }
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("Downloaded file was empty.");
      }
      triggerDownload(blob, filename);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const baseMeta = { subject, grade, topic };

  const onDownloadPpt = () => {
    const fullLessonPlan = getPptSourceLessonText(lessonPlan);
    const pptContent = getPptSourceSlideOutline(lessonPlan);
    const lo = learningObjectives?.trim() || "";
    const hw = typeof lessonPlan["Homework Task"] === "string" ? lessonPlan["Homework Task"].trim() : "";

    console.log("[PPT export] Download clicked:", {
      fullLessonPlanChars: fullLessonPlan.length,
      pptContentChars: pptContent.length,
      subject,
      grade,
      topicPreview: topic.slice(0, 80),
    });

    const urls =
      Array.isArray(pptSlideImageUrls) && pptSlideImageUrls.length >= STRUCTURED_LESSON_DECK_SLIDE_COUNT
        ? pptSlideImageUrls.slice(0, STRUCTURED_LESSON_DECK_SLIDE_COUNT)
        : undefined;

    return runExport(
      "ppt",
      `${baseName}-ppt.pptx`,
      "/api/lesson-plan/export/pptx",
      {
        ...baseMeta,
        pptContent,
        fullLessonPlan,
        learningObjectives: lo,
        homeworkTask: hw,
        teacherName: teacherName?.trim() || "",
        pptTheme: pptThemeId,
        curriculumFramework: curriculumFramework?.trim() ?? "",
        ...(hasAflSelections(aflSelections) ? { aflSelections } : {}),
        ...(urls ? { pptSlideImageUrls: urls } : {}),
      },
    );
  };

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
        ...(hasAflSelections(aflSelections) ? { aflSelections } : {}),
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

  const onDownloadAflSheets = () =>
    runExport(
      "afl-sheets",
      `${baseName}-afl-activity-sheets.docx`,
      "/api/lesson-plan/export/docx",
      {
        ...baseMeta,
        documentTitle: "AFL Activity Sheets",
        fileBaseName: "afl-activity-sheets",
        content: lessonPlan["AFL Activity Sheets"] ?? "",
      },
    );

  const onDownloadZip = () => {
    const planForZip =
      pptSlideImageUrls && pptSlideImageUrls.length >= STRUCTURED_LESSON_DECK_SLIDE_COUNT
        ? mergePptSlideImageUrlsIntoPlan(lessonPlan, pptSlideImageUrls)
        : lessonPlan;
    return runExport("zip", `${baseName}-all.zip`, "/api/lesson-plan/export/zip", {
      ...baseMeta,
      lessonPlan: planForZip,
      ...(hasAflSelections(aflSelections) ? { aflSelections } : {}),
    });
  };

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
                className="animate-slide-up stagger-1 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
              >
                {busy === "ppt" ? (pptSlideImageUrls?.some(Boolean) ? "Preparing file…" : "Generating images…") : "Download PPT"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Structured deck · Layah theme
                </span>
              </button>
              ) : null}
              {hasLesson ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadLessonPlan}
                className="animate-slide-up stagger-2 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
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
                className="animate-slide-up stagger-3 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
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
                className="animate-slide-up stagger-4 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
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
                className="animate-slide-up stagger-5 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
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
                className="animate-slide-up stagger-6 flex min-h-[3rem] flex-col justify-center rounded-xl border border-[#00C6A7]/30 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10 hover:shadow-md disabled:opacity-50"
              >
                {busy === "notes" ? "Preparing…" : "Download Teacher Notes"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Word (.docx)</span>
              </button>
              ) : null}
              {hasAflSheets ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={onDownloadAflSheets}
                className="animate-slide-up stagger-7 flex min-h-[3rem] flex-col justify-center rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-50 hover:shadow-md disabled:opacity-50"
              >
                {busy === "afl-sheets" ? "Preparing…" : "Download AFL Activity Sheets"}
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Printable student handouts · Word (.docx)
                </span>
              </button>
              ) : null}
            </div>
            <PptImageProgressCard
              active={busy === "ppt"}
              packagingOnly={Boolean(pptSlideImageUrls?.some(Boolean))}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={onDownloadZip}
              className="animate-slide-up stagger-8 mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#00C6A7] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0A8F7A] hover:shadow-lg disabled:opacity-50 sm:w-auto"
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

      {exportError ? <p className="animate-shake text-sm text-red-600">{exportError}</p> : null}

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
          className="flex min-w-0 gap-2 border-b border-[#00C6A7]/20 pb-3"
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
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C6A7] focus-visible:ring-offset-2 min-h-10 ${
                  selected
                    ? "bg-[#00C6A7] text-white shadow-md"
                    : "border border-[#00C6A7]/30 bg-white text-[#0A1628] hover:bg-[#00C6A7]/10"
                }`}
              >
                {getSectionTabLabel(key)}
              </button>
            );
          })}
        </div>
      </div>

      <article
        className="rounded-2xl border border-[#00C6A7]/20 bg-gradient-to-b from-[#00C6A7]/5 to-white p-5 shadow-sm md:p-6"
        role="tabpanel"
      >
        <div className="flex flex-col gap-1 border-b border-[#00C6A7]/20 pb-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              {activeKey ? getSectionTabLabel(activeKey) : "Section"}
            </h4>
            {activeKey ? (
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[#00C6A7]">
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
                    className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm ring-[#00C6A7] transition hover:ring-2"
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
