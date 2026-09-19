"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/panel";
import { useErrorToast } from "@/hooks/use-error-toast";
import { ArtifactWorkspace, type WorkspaceArtifact } from "./artifact-workspace";
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
import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";
import { triggerFileDownload } from "@/lib/trigger-file-download";
import type { PresentationLanguage } from "@/lib/ppt-language";
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
  /** Chapter from the generator form; needed by the deck builder's slide-2 dedupe. */
  chapter?: string;
  /** Deck language, so the export renders in the language the teacher selected. */
  language?: PresentationLanguage;
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
  saved?: boolean;
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
  chapter,
  language,
  aflSelections,
  pptSlideImageUrls,
  parseNotice,
  onRegenerate,
  onSave,
  saving,
  saved,
  onSendToDifferentiatedPack,
}: TeacherPackageViewerProps) {
  const sectionKeys = useMemo(() => getLessonPlanDisplayOrder(lessonPlan), [lessonPlan]);
  const [localThemeId, setLocalThemeId] = useState(pptThemeId);
  const selectedThemeId = onPptThemeChange ? pptThemeId : localThemeId;
  const [activeKey, setActiveKey] = useState(sectionKeys[0] ?? "");
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [exportError, setExportError] = useErrorToast();
  const [templateMode, setTemplateMode] = useState<"layah" | "uploaded">("layah");
  const [savedTemplate, setSavedTemplate] = useState<{ original_filename: string; thumbnail_base64: string | null } | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateWarning, setTemplateWarning] = useState<{ code: string; error: string; slide: number | null } | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/school-template", { headers: await getAuthHeaders(), cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { template?: { original_filename: string; thumbnail_base64: string | null } | null };
        if (live) setSavedTemplate(result.template ?? null);
      } catch {
        // The built-in template choice remains available.
      }
    })();
    return () => { live = false; };
  }, []);

  const uploadTemplate = async (file: File) => {
    setTemplateBusy(true);
    setTemplateWarning(null);
    setExportError(null);
    try {
      const form = new FormData();
      form.append("template", file);
      const response = await fetch("/api/school-template/upload", {
        method: "POST",
        headers: await getAuthOnlyHeaders(),
        body: form,
      });
      const result = await response.json() as { error?: string; originalFilename?: string; thumbnailBase64?: string | null };
      if (!response.ok) throw new Error(result.error || "PowerPoint upload failed.");
      setSavedTemplate({ original_filename: result.originalFilename || file.name, thumbnail_base64: result.thumbnailBase64 ?? null });
      setTemplateMode("uploaded");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PowerPoint upload failed.");
    } finally {
      setTemplateBusy(false);
    }
  };

  const removeTemplate = async () => {
    setTemplateBusy(true);
    try {
      const response = await fetch("/api/school-template", { method: "DELETE", headers: await getAuthHeaders() });
      if (!response.ok) throw new Error("Could not remove the saved PowerPoint.");
      setSavedTemplate(null);
      setTemplateMode("layah");
      setTemplateWarning(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not remove the saved PowerPoint.");
    } finally {
      setTemplateBusy(false);
    }
  };

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
    if (key === "ppt") setTemplateWarning(null);
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
        if (key === "ppt") {
          try {
            const issue = JSON.parse(raw) as { code?: string; error?: string; slide?: number | null };
            if (issue.code && issue.error) {
              setTemplateWarning({ code: issue.code, error: issue.error, slide: issue.slide ?? null });
              return;
            }
          } catch { /* Fall through to the standard export error. */ }
        }
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

  const baseMeta = {
    subject,
    grade,
    topic,
    ...(chapter?.trim() ? { chapter: chapter.trim() } : {}),
    ...(language ? { language } : {}),
  };

  const onDownloadPpt = (mode: "layah" | "uploaded" = templateMode) => {
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
        pptTheme: selectedThemeId,
        templateMode: mode,
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

  const rawOverviewCards: (OverviewCard | null)[] = [
    hasPpt
      ? ({
          key: "ppt",
          title: "Presentation",
          description: "Structured slide deck · Layah theme",
          icon: PresentationIcon,
          onDownload: () => onDownloadPpt(),
        } as OverviewCard)
      : null,
    hasAflSheets
      ? ({
          key: "afl-sheets",
          title: "AFL activity sheets",
          description: "Printable student handouts · Word (.docx)",
          icon: FileStack,
          onDownload: onDownloadAflSheets,
        } as OverviewCard)
      : null,
    hasLesson
      ? ({
          key: "lesson",
          title: "Lesson Plan",
          description: "Full write-up · Word (.docx)",
          icon: BookOpen,
          onDownload: onDownloadLessonPlan,
        } as OverviewCard)
      : null,
    hasWorksheet
      ? ({
          key: "worksheet",
          title: "Worksheet Pack",
          description: "Student practice · Word (.docx)",
          icon: FileStack,
          onDownload: onDownloadWorksheet,
        } as OverviewCard)
      : null,
    hasAssessment
      ? ({
          key: "assessment",
          title: "Assessment Questions",
          description: "Graded checks · Word (.docx)",
          icon: ClipboardCheck,
          onDownload: onDownloadAssessment,
        } as OverviewCard)
      : null,
    hasHomework
      ? ({
          key: "homework",
          title: "Homework Tasks",
          description: "Take-home practice · Word (.docx)",
          icon: PencilLine,
          onDownload: onDownloadHomework,
        } as OverviewCard)
      : null,
    hasNotes
      ? ({
          key: "notes",
          title: "Teacher Notes",
          description: "Delivery guidance · Word (.docx)",
          icon: StickyNote,
          onDownload: onDownloadTeacherNotes,
        } as OverviewCard)
      : null,
  ];
  const overviewCards = rawOverviewCards.filter((c): c is OverviewCard => c !== null);

  const exportKeys: Record<string, ExportKey> = {
    "PPT Slide Content": "ppt", "Full Lesson Plan": "lesson", Worksheet: "worksheet",
    "Assessment Questions": "assessment", "Homework Task": "homework", "Teacher Notes": "notes", "AFL Activity Sheets": "afl-sheets",
  };
  const artifacts: WorkspaceArtifact[] = sectionKeys.map((key) => {
    const card = overviewCards.find((item) => item.key === exportKeys[key]);
    return { id: key, title: card?.title ?? getSectionTabLabel(key), description: card?.description, icon: card?.icon, onDownload: card?.onDownload, downloadLabel: key === "PPT Slide Content" ? "Download PowerPoint" : "Download Word" };
  });

  return (
    <div className="workspace-page">
      <input id="uploaded-ppt-input" className="sr-only" tabIndex={-1} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={templateBusy || busy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadTemplate(file); event.target.value = ""; }} />
      <header className="page-header">
        <div className="min-w-0">
          <p className="page-kicker flex items-center gap-2"><CheckCircle2 className="size-4" aria-hidden />Lesson package</p>
          <h1 className="page-title break-words">{topic}</h1>
          <p className="page-description">{[subject, grade, curriculumFramework].filter(Boolean).join(" / ")}</p>
        </div>
        {onRegenerate ? <Button variant="outline" onClick={onRegenerate} disabled={busy !== null}>Edit lesson details</Button> : null}
      </header>
      {exportError ? <Notice tone="danger" className="mb-5">{exportError}</Notice> : null}
      {templateWarning ? (
        <Notice tone="danger" className="mb-5">
          <p className="font-semibold">This PowerPoint could not fit your lesson.</p>
          <p className="mt-1">{templateWarning.slide ? `Slide ${templateWarning.slide}: ` : ""}{templateWarning.error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={busy !== null} onClick={() => { setTemplateMode("layah"); setTemplateWarning(null); void onDownloadPpt("layah"); }}>Use a Layah template</Button>
            <Button variant="outline" disabled={templateBusy || busy !== null} onClick={() => { setTemplateWarning(null); document.getElementById("uploaded-ppt-input")?.click(); }}>Upload another PowerPoint</Button>
            <Button variant="ghost" onClick={() => setTemplateWarning(null)}>Cancel</Button>
          </div>
        </Notice>
      ) : null}
      {parseNotice ? <Notice tone="generated" className="mb-5">{parseNotice}</Notice> : null}
      {!showTeacherDownloads ? <Notice className="mb-5">This lesson uses an older format. Generate a new lesson to create downloadable materials.</Notice> : null}
      {busy === "ppt" ? <Notice tone="brand" className="mb-5"><p role="status" aria-live="polite">Preparing your PowerPoint. The download will start when the file is ready.</p></Notice> : null}
      <ArtifactWorkspace artifacts={artifacts} activeId={activeKey} onSelect={setActiveKey} busy={busy !== null || templateBusy} downloading={busy === exportKeys[activeKey]}
        sidebarFooter={(onSave || saved || onSendToDifferentiatedPack) ? <div className="space-y-2">{saved ? <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted"><CheckCircle2 className="size-4 text-brand-text" aria-hidden />Saved to My lessons</p> : null}{onSave ? <Button variant="outline" block onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save to my lessons"}</Button> : null}{onSendToDifferentiatedPack ? <Button variant="outline" block onClick={onSendToDifferentiatedPack}>Create worksheet pack</Button> : null}<p className="px-1 text-sm leading-relaxed text-faint">Review each document before sharing it with your class.</p></div> : null}
      >
                {activeKey === "PPT Slide Content" && hasPpt ? (
                  <div className="mb-4 border-b border-line-subtle pb-4">
                    <p className="mb-2 text-sm font-medium text-faint">
                      Slide template
                    </p>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant={templateMode === "layah" ? "default" : "outline"} onClick={() => { setTemplateMode("layah"); setTemplateWarning(null); }}>
                        Layah templates
                      </Button>
                      {savedTemplate ? (
                        <Button type="button" size="sm" variant={templateMode === "uploaded" ? "default" : "outline"} onClick={() => { setTemplateMode("uploaded"); setTemplateWarning(null); }}>
                          My PowerPoint
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" disabled={templateBusy || busy !== null} onClick={() => document.getElementById("uploaded-ppt-input")?.click()}>
                        {templateBusy ? "Uploading…" : savedTemplate ? "Replace PowerPoint" : "Upload PowerPoint"}
                      </Button>
                    </div>
                    {savedTemplate ? (
                      <div className="mb-3 flex items-center gap-3 rounded-md border border-line-subtle bg-surface p-2 text-sm">
                        {savedTemplate.thumbnail_base64?.startsWith("data:image/") ? <img src={savedTemplate.thumbnail_base64} alt="PowerPoint preview" className="h-12 w-20 object-contain" /> : null}
                        <span className="min-w-0 flex-1 truncate">{savedTemplate.original_filename}</span>
                        <Button type="button" variant="ghost" size="xs" disabled={templateBusy || busy !== null} onClick={() => void removeTemplate()}>Remove</Button>
                      </div>
                    ) : null}
                    {templateMode === "uploaded" ? <p className="mb-3 text-sm text-faint">Your lesson will use the uploaded slide design. If its editable areas cannot hold the lesson, we&apos;ll ask you to choose a Layah template.</p> : null}
                    {templateMode === "layah" ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {PPT_THEME_CARDS.map((t) => {
                        const selected = selectedThemeId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { setLocalThemeId(t.id); onPptThemeChange?.(t.id); }}
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
                            <p className="text-sm font-medium text-faint">
                              {t.themeNumber}
                            </p>
                            <p className="truncate text-sm font-medium text-ink">{t.name}</p>
                          </button>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                ) : null}

        <div className={activeImageList.length ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]" : ""}>
          <div className="artifact min-w-0">{renderedActiveContent}</div>
          {activeImageList.length > 0 ? <aside className="space-y-3 border-t border-line pt-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0"><p className="text-sm font-medium text-faint">Illustrations</p>{activeImageList.map((src) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line bg-sunken"><img src={src} alt="Educational illustration for this section" className="h-auto w-full object-contain" loading="lazy" /></a>)}</aside> : null}
        </div>
      </ArtifactWorkspace>
    </div>
  );
}
