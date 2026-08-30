"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useErrorToast } from "@/hooks/use-error-toast";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileStack,
  PencilLine,
  Presentation as PresentationIcon,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import {
  getLessonPlanDisplayOrder,
  getPptSourceLessonText,
  getPptSourceSlideOutline,
  getSectionTabLabel,
  hasTeacherPackageContent,
  mergePptSlideImageUrlsIntoPlan,
  type LessonPlanResult,
  type SectionImageMap,
} from "@/lib/lesson-plan";
import { AFL_PHASE_IDS, type AflSelectionsPayload } from "@/lib/afl-tools";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  TEMPLATE_CARDS as PPT_THEME_CARDS,
  type TemplateId as PptThemeId,
} from "@/lib/ppt-template-config";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { getAuthHeaders } from "@/lib/auth-headers";
import { triggerFileDownload } from "@/lib/trigger-file-download";
import { toUserFacingError, USER_FACING_ERROR } from "@/lib/user-facing-errors";

function hasAflSelections(s: AflSelectionsPayload | undefined): boolean {
  if (!s) return false;
  return AFL_PHASE_IDS.some((p) => (s[p]?.length ?? 0) > 0);
}

type TeacherPackageViewerProps = {
  lessonPlan: LessonPlanResult;
  /** Optional section illustration URLs, keyed by teacher-package section title. */
  sectionImages?: SectionImageMap;
  subject: string;
  grade: string;
  topic: string;
  /** When set, PPT slide images use the same framework hint as generation. */
  curriculumFramework?: string;
  /** PowerPoint template from the generator; defaults to Classic. */
  pptThemeId?: PptThemeId;
  /** Called when the teacher picks a different PPT template card. */
  onPptThemeChange?: (id: PptThemeId) => void;
  /** Shown on title slide and sent to export API. */
  teacherName?: string;
  /** Learning objectives line from the generator form (enriches PPT objectives slide). */
  learningObjectives?: string;
  /** Teacher-selected AFL tools from the generator (PPT + lesson plan exports). */
  aflSelections?: AflSelectionsPayload;
  /** Pre-generated PPT slide URLs from lesson generation (embedded at download time). */
  pptSlideImageUrls?: (string | null)[] | null;
  /** Any parse notice from generation, surfaced under the success header. */
  parseNotice?: string | null;
  /** Resets the wizard so the teacher can change inputs and generate again. */
  onRegenerate?: () => void;
  /** Persists this package to My Lessons. */
  onSave?: () => void;
  saving?: boolean;
  /** Sends this lesson to the Differentiated Worksheet Pack tool. */
  onSendToDifferentiatedPack?: () => void;
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

// ── PPT export progress (visual only; images are usually pre-built during generation) ──
const TOTAL_IMAGES = 10;

const IMAGE_MILESTONES_FULL: { at: number; count: number; label: string }[] = [
  { at: 4, count: 1, label: "Title slide image (Pexels)" },
  { at: 8, count: 2, label: "Starter image (Pexels)" },
  { at: 12, count: 3, label: "UAE link image (Pexels)" },
  { at: 16, count: 4, label: "Plenary image (Pexels)" },
  { at: 20, count: 5, label: "Extended task image (Pexels)" },
  { at: 35, count: 6, label: "SDG / chapter illustration" },
  { at: 50, count: 7, label: "Main phase diagram" },
  { at: 65, count: 8, label: "Differentiated activity art" },
  { at: 80, count: 9, label: "Exit ticket graphic" },
  { at: 95, count: 10, label: "Success criteria graphic" },
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

  const allDone = imgCount >= TOTAL_IMAGES;

  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 14,
        border: "1px solid color-mix(in oklch, var(--brand) 30%, transparent)",
        background: "linear-gradient(135deg, var(--text) 0%, var(--l-gray-11) 100%)",
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
              background: "linear-gradient(90deg,var(--brand),#00e8c3)",
              borderRadius: 99,
              boxShadow: "0 0 8px color-mix(in oklch, var(--brand) 60%, transparent)",
              transition: "width 0.8s ease",
            }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", minWidth: 52, textAlign: "right" }}>
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

      {allDone ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
            All done!
          </span>
        </div>
      ) : null}
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

type OverviewCard = {
  key: ExportKey;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "teal" | "violet";
  onDownload: () => void | Promise<void>;
};

export function TeacherPackageViewer({
  lessonPlan,
  sectionImages,
  subject,
  grade,
  topic,
  curriculumFramework,
  pptThemeId = DEFAULT_PPT_THEME_ID,
  onPptThemeChange,
  teacherName,
  learningObjectives,
  aflSelections,
  pptSlideImageUrls,
  parseNotice,
  onRegenerate,
  onSave,
  saving,
  onSendToDifferentiatedPack,
}: TeacherPackageViewerProps) {
  const sectionKeys = useMemo(() => getLessonPlanDisplayOrder(lessonPlan), [lessonPlan]);
  const [activeKey, setActiveKey] = useState(sectionKeys[0] ?? "");
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [exportError, setExportError] = useErrorToast();

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
  // Memoized so flipping back to a previously-viewed tab reuses the parsed
  // markdown instead of re-parsing on every click.
  const renderedActiveContent = useMemo(
    () => <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeContent}</ReactMarkdown>,
    [activeContent],
  );
  const activeIllustrationUrls =
    activeKey && sectionImages?.[activeKey as keyof SectionImageMap];
  const activeImageList = Array.isArray(activeIllustrationUrls) ? activeIllustrationUrls : [];

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
        headers: { ...(await getAuthHeaders()), ...(extraHeaders ?? {}) },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const raw = await res.text();
        console.error(`[teacher-package export ${key}] HTTP ${res.status}`, raw.slice(0, 500));
        throw new Error(USER_FACING_ERROR);
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
      triggerFileDownload(blob, filename);
    } catch (e) {
      setExportError(toUserFacingError(e, `export-${key}`));
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
        documentTitle: "Activity Sheet AFL",
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

  const rawOverviewCards: (OverviewCard | null)[] = [
    hasPpt
      ? ({
          key: "ppt",
          title: "PPT- Presentation",
          description: "Structured slide deck · Layah theme",
          icon: PresentationIcon,
          accent: "teal",
          onDownload: onDownloadPpt,
        } as OverviewCard)
      : null,
    hasAflSheets
      ? ({
          key: "afl-sheets",
          title: "Activity Sheet AFL",
          description: "Printable student handouts · Word (.docx)",
          icon: FileStack,
          accent: "violet",
          onDownload: onDownloadAflSheets,
        } as OverviewCard)
      : null,
    hasLesson
      ? ({
          key: "lesson",
          title: "Lesson Plan",
          description: "Full write-up · Word (.docx)",
          icon: BookOpen,
          accent: "teal",
          onDownload: onDownloadLessonPlan,
        } as OverviewCard)
      : null,
    hasWorksheet
      ? ({
          key: "worksheet",
          title: "Worksheet Pack",
          description: "Student practice · Word (.docx)",
          icon: FileStack,
          accent: "teal",
          onDownload: onDownloadWorksheet,
        } as OverviewCard)
      : null,
    hasAssessment
      ? ({
          key: "assessment",
          title: "Assessment Questions",
          description: "Graded checks · Word (.docx)",
          icon: ClipboardCheck,
          accent: "teal",
          onDownload: onDownloadAssessment,
        } as OverviewCard)
      : null,
    hasHomework
      ? ({
          key: "homework",
          title: "Homework Tasks",
          description: "Take-home practice · Word (.docx)",
          icon: PencilLine,
          accent: "teal",
          onDownload: onDownloadHomework,
        } as OverviewCard)
      : null,
    hasNotes
      ? ({
          key: "notes",
          title: "Teacher Notes",
          description: "Delivery guidance · Word (.docx)",
          icon: StickyNote,
          accent: "teal",
          onDownload: onDownloadTeacherNotes,
        } as OverviewCard)
      : null,
  ];
  const overviewCards = rawOverviewCards.filter((c): c is OverviewCard => c !== null);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* ══════════ SUCCESS HEADER ══════════ */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-[var(--surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand-text">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">Teacher Package Ready</h2>
            <p className="mt-1 text-sm text-muted">
              Your lesson plan, PPT, worksheets, homework, assessment, and teacher notes have been
              generated successfully.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-[var(--surface)] px-4 text-sm font-semibold text-muted transition hover:border-line-strong hover:bg-hover"
            >
              Regenerate
            </button>
          ) : null}
          {showTeacherDownloads ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={onDownloadZip}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
            >
              {busy === "zip" ? "Building ZIP…" : "Download ZIP"}
            </button>
          ) : null}
        </div>
      </div>

      {exportError ? (
        <p className="animate-shake mb-4 text-sm text-red-600">{exportError}</p>
      ) : null}
      {parseNotice ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {parseNotice}
        </p>
      ) : null}

      {!showTeacherDownloads ? (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          File downloads (PPT, Word, and ZIP) are available when your plan includes at least one
          teacher-package section (lesson plan, slides, worksheet, and so on). Legacy-format plans
          cannot be exported here — generate a new package to unlock downloads.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ══════════ SIDEBAR ══════════ */}
        <aside className="space-y-6 lg:col-span-4">
          {overviewCards.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
                Package overview
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {overviewCards.map((card) => {
                  const Icon = card.icon;
                  const isViolet = card.accent === "violet";
                  return (
                    <div
                      key={card.key}
                      className="rounded-xl border border-line bg-[var(--surface)] p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            isViolet ? "bg-violet-50 text-violet-600" : "bg-brand-subtle text-brand-text"
                          }`}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{card.title}</p>
                          <p className="mt-0.5 text-xs text-muted">{card.description}</p>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={card.onDownload}
                            className={`mt-3 inline-flex min-h-8 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                              isViolet
                                ? "border-violet-300 text-violet-700 hover:bg-violet-50"
                                : "border-brand text-brand-text hover:bg-brand-subtle"
                            }`}
                          >
                            {busy === card.key ? "Preparing…" : "Download"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PptImageProgressCard
                active={busy === "ppt"}
                packagingOnly={Boolean(pptSlideImageUrls?.some(Boolean))}
              />
            </div>
          ) : null}

          {onSave || onSendToDifferentiatedPack ? (
            <div className="space-y-2">
              {onSave ? (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex w-full min-h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save Lesson Plan"}
                </button>
              ) : null}
              {onSendToDifferentiatedPack ? (
                <button
                  type="button"
                  onClick={onSendToDifferentiatedPack}
                  className="inline-flex w-full min-h-10 items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-100"
                >
                  Generate Differentiated Worksheet Pack
                </button>
              ) : null}
            </div>
          ) : null}
        </aside>

        {/* ══════════ MAIN PREVIEW ══════════ */}
        <div className="lg:col-span-8">
          <div className="overflow-x-auto pb-1">
            <div
              className="flex min-w-0 gap-2 border-b border-line pb-3"
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
                    className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-10 ${
                      selected
                        ? "text-white"
                        : "border border-line bg-[var(--surface)] text-muted hover:bg-hover"
                    }`}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="teacher-package-active-tab"
                        className="absolute inset-0 rounded-full bg-brand shadow-md"
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative">{getSectionTabLabel(key)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <article
            className="mt-4 overflow-hidden rounded-2xl border border-line bg-[var(--surface)] p-5 shadow-sm md:p-6"
            role="tabpanel"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeKey}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="flex flex-col gap-1 border-b border-line pb-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-ink">
                      {activeKey ? getSectionTabLabel(activeKey) : "Section"}
                    </h4>
                  </div>
                </div>

                {activeKey === "PPT Slide Content" && hasPpt ? (
                  <div className="mt-4 border-b border-line pb-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
                      Presentation template
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {PPT_THEME_CARDS.map((t) => {
                        const selected = pptThemeId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onPptThemeChange?.(t.id)}
                            aria-pressed={selected}
                            className={`rounded-xl border-2 bg-[var(--surface)] p-2.5 text-left shadow-sm transition hover:shadow-md ${
                              selected ? "border-teal-500 ring-2 ring-teal-100" : "border-line hover:border-line-strong"
                            }`}
                          >
                            <div className="mb-2 flex h-12 gap-1 overflow-hidden rounded-lg" aria-hidden>
                              {t.preview.map((hex) => (
                                <span key={hex} className="h-full min-w-0 flex-1" style={{ backgroundColor: `#${hex}` }} />
                              ))}
                            </div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
                              Template {t.themeNumber}
                            </p>
                            <p className="text-xs font-semibold text-ink">{t.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid max-h-[min(70vh,780px)] gap-4 overflow-y-auto lg:grid-cols-[1fr_min(280px,32%)]">
                  <div className="min-h-0 min-w-0 overflow-y-auto">
                    <div className="prose prose-slate prose-sm max-w-none prose-headings:font-bold prose-headings:text-ink prose-p:text-muted prose-li:text-muted prose-strong:text-ink sm:prose-base">
                      {renderedActiveContent}
                    </div>
                  </div>
                  {activeImageList.length > 0 ? (
                    <aside className="flex min-h-0 flex-col gap-3 border-t border-line-subtle pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                        Section illustration
                      </p>
                      <div className="space-y-3 overflow-y-auto">
                        {activeImageList.map((src) => (
                          <a
                            key={src}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-line bg-hover shadow-sm ring-teal-500 transition hover:ring-2"
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
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </article>
        </div>
      </div>
    </div>
  );
}
