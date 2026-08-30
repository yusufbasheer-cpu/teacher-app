"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/panel";
import { useErrorToast } from "@/hooks/use-error-toast";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
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
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      {/* Was a full-width banner announcing success and re-listing every
          artifact by name — a paragraph of confirmation for something the
          screen already demonstrates. The heading now names the lesson, which
          is the useful fact, and the actions sit where the eye lands. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0 text-brand-text" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-wider text-brand-text">
              Package ready
            </span>
          </div>
          <h1 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.015em] text-ink">
            {topic}
          </h1>
          <p className="mt-0.5 text-[12px] text-faint">
            {[subject, grade, curriculumFramework].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onRegenerate ? (
            <Button variant="ghost" size="lg" onClick={onRegenerate}>
              Edit and regenerate
            </Button>
          ) : null}
          {showTeacherDownloads ? (
            <Button size="lg" disabled={busy !== null} onClick={onDownloadZip}>
              <Download />
              {busy === "zip" ? "Building ZIP…" : "Download all"}
            </Button>
          ) : null}
        </div>
      </div>

      {exportError ? (
        <Notice tone="danger" className="animate-shake mb-3">
          {exportError}
        </Notice>
      ) : null}
      {parseNotice ? (
        <Notice tone="generated" className="mb-3">
          {parseNotice}
        </Notice>
      ) : null}

      {!showTeacherDownloads ? (
        <Notice tone="generated" className="mb-3">
          Downloads open up once your package includes at least one teacher section — a plan,
          slides, a worksheet and so on. Plans saved in the older format can&apos;t be exported;
          generate a new one to unlock them.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ══════════ SIDEBAR ══════════ */}
        <aside className="space-y-6 lg:col-span-4">
          {overviewCards.length > 0 ? (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-disabled">
                In this package
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {overviewCards.map((card) => {
                  const Icon = card.icon;
                  const isViolet = card.accent === "violet";
                  return (
                    <div
                      key={card.key}
                      className="rounded-md border border-line-subtle bg-surface p-2.5 transition-colors duration-[110ms] hover:border-line-strong"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-sunken text-faint">
                          <Icon size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-ink">{card.title}</p>
                          <p className="mt-0.5 text-[11px] text-faint">{card.description}</p>
                          <Button
                            variant="outline"
                            size="xs"
                            className="mt-1.5"
                            disabled={busy !== null}
                            onClick={card.onDownload}
                          >
                            {busy === card.key ? "Preparing…" : "Download"}
                          </Button>
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
                <Button variant="outline" block onClick={onSave} disabled={saving}>
                  {saving ? "Saving…" : "Save to my lessons"}
                </Button>
              ) : null}
              {onSendToDifferentiatedPack ? (
                <Button variant="ghost" block onClick={onSendToDifferentiatedPack}>
                  Send to worksheet pack
                </Button>
              ) : null}
            </div>
          ) : null}
        </aside>

        {/* ══════════ MAIN PREVIEW ══════════ */}
        <div className="lg:col-span-8">
          {/* Section navigation. Was a row of pill buttons with a spring-
              animated green blob sliding between them; the package's sections
              are a *sequence* (starter → main → assessment → homework), so the
              ruled margin the composer uses carries that better than pills. */}
          <div
            className="flex gap-0.5 overflow-x-auto border-b border-line-subtle"
            role="tablist"
            aria-label="Package sections"
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
                  className={`relative shrink-0 px-3 py-2 text-[13px] transition-colors duration-[110ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand ${
                    selected
                      ? "font-medium text-ink"
                      : "text-faint hover:text-muted"
                  }`}
                >
                  {getSectionTabLabel(key)}
                  <span
                    aria-hidden
                    className={`absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full bg-brand transition-opacity duration-[110ms] ${
                      selected ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <article
            className="on-surface mt-4 overflow-hidden rounded-lg border border-line-subtle bg-surface p-4 md:p-6"
            role="tabpanel"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                {activeKey === "PPT Slide Content" && hasPpt ? (
                  <div className="mb-4 border-b border-line-subtle pb-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-disabled">
                      Slide template
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
                            className={`rounded-md border bg-surface p-2 text-left transition-colors duration-[110ms] ${
                              selected
                                ? "border-brand bg-brand-subtle"
                                : "border-line-subtle hover:border-line-strong"
                            }`}
                          >
                            <div className="mb-1.5 flex h-10 gap-0.5 overflow-hidden rounded-sm" aria-hidden>
                              {t.preview.map((hex) => (
                                <span key={hex} className="h-full min-w-0 flex-1" style={{ backgroundColor: `#${hex}` }} />
                              ))}
                            </div>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-disabled">
                              {t.themeNumber}
                            </p>
                            <p className="truncate text-[12px] font-medium text-ink">{t.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid max-h-[min(70vh,780px)] gap-4 overflow-y-auto lg:grid-cols-[1fr_min(280px,32%)]">
                  <div className="min-h-0 min-w-0 overflow-y-auto">
                    <div className="artifact">{renderedActiveContent}</div>
                  </div>
                  {activeImageList.length > 0 ? (
                    <aside className="flex min-h-0 flex-col gap-3 border-t border-line-subtle pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-disabled">
                        Illustration
                      </p>
                      <div className="space-y-3 overflow-y-auto">
                        {activeImageList.map((src) => (
                          <a
                            key={src}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-md border border-line-subtle bg-sunken transition-colors hover:border-brand"
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
