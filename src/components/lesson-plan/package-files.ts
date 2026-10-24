"use client";

import { getAuthHeaders } from "@/lib/auth-headers";
import { AFL_PHASE_IDS, type AflSelectionsPayload } from "@/lib/afl-tools";
import { mergePptSlideImageUrlsIntoPlan, type LessonPlanResult } from "@/lib/lesson-plan";

/**
 * The lesson package's downloadable files, built once in the background as soon as the lesson text exists
 * (while the slides are still being designed), so every Download click afterwards is instant. The Word files
 * come from the same export route, with the same bodies, as the viewer's on-demand downloads.
 */

export type ReadyFile = { blob: Blob; filename: string; label: string };
export type ReadyFiles = Record<string, ReadyFile>;

export const PACKAGE_DOCX_FILES = [
  { key: "lesson", section: "Full Lesson Plan", documentTitle: "Lesson Plan", fileBaseName: "lesson-plan", label: "Lesson plan" },
  { key: "afl-sheets", section: "AFL Activity Sheets", documentTitle: "Activity Sheet AFL", fileBaseName: "afl-activity-sheets", label: "AFL activity sheets" },
  { key: "worksheet", section: "Worksheet", documentTitle: "Worksheet", fileBaseName: "worksheet", label: "Worksheet" },
  { key: "assessment", section: "Assessment Questions", documentTitle: "Assessment Questions", fileBaseName: "assessment", label: "Assessment questions" },
  { key: "homework", section: "Homework Task", documentTitle: "Homework", fileBaseName: "homework", label: "Homework" },
  { key: "notes", section: "Teacher Notes", documentTitle: "Teacher Notes", fileBaseName: "teacher-notes", label: "Teacher notes" },
] as const;

export type PackageDocxKey = (typeof PACKAGE_DOCX_FILES)[number]["key"];

export type PackageMeta = {
  subject: string;
  grade: string;
  topic: string;
  chapter?: string;
  language?: string;
  aflSelections?: AflSelectionsPayload;
};

function hasAflSelections(s: AflSelectionsPayload | undefined): s is AflSelectionsPayload {
  return !!s && AFL_PHASE_IDS.some((p) => (s[p]?.length ?? 0) > 0);
}

function baseMeta(m: PackageMeta) {
  return {
    subject: m.subject,
    grade: m.grade,
    topic: m.topic,
    ...(m.chapter?.trim() ? { chapter: m.chapter.trim() } : {}),
    ...(m.language ? { language: m.language } : {}),
  };
}

export function docxFile(key: PackageDocxKey, plan: LessonPlanResult, meta: PackageMeta, baseName: string) {
  const def = PACKAGE_DOCX_FILES.find((d) => d.key === key)!;
  const content = plan[def.section];
  return {
    filename: `${baseName}-${def.fileBaseName}.docx`,
    label: def.label,
    hasContent: typeof content === "string" && content.trim().length > 0,
    body: {
      ...baseMeta(meta),
      documentTitle: def.documentTitle,
      fileBaseName: def.fileBaseName,
      content: typeof content === "string" ? content : "",
      ...(key === "lesson" && hasAflSelections(meta.aflSelections) ? { aflSelections: meta.aflSelections } : {}),
    },
  };
}

export function zipRequestBody(plan: LessonPlanResult, meta: PackageMeta, pptSlideImageUrls: (string | null)[] | null | undefined, slideCount: number) {
  const lessonPlan = pptSlideImageUrls && pptSlideImageUrls.length >= slideCount ? mergePptSlideImageUrlsIntoPlan(plan, pptSlideImageUrls) : plan;
  return { ...baseMeta(meta), lessonPlan, ...(hasAflSelections(meta.aflSelections) ? { aflSelections: meta.aflSelections } : {}) };
}

async function postForBlob(url: string, body: object): Promise<Blob | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: await getAuthHeaders(), body: JSON.stringify(body) });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Builds every Word file the package has. A file that fails is simply left out: its button falls back to on-demand. */
export async function prefetchDocxFiles(plan: LessonPlanResult, meta: PackageMeta, baseName: string): Promise<ReadyFiles> {
  const entries = await Promise.all(
    PACKAGE_DOCX_FILES.map(async ({ key }) => {
      const f = docxFile(key, plan, meta, baseName);
      if (!f.hasContent) return null;
      const blob = await postForBlob("/api/lesson-plan/export/docx", f.body);
      return blob ? ([key, { blob, filename: f.filename, label: f.label }] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}

/** The server's package ZIP (its PowerPoint is the built-in Layah design). Used when there is no Gamma deck. */
export async function fetchServerZip(body: object, filename: string): Promise<ReadyFile | null> {
  const blob = await postForBlob("/api/lesson-plan/export/zip", body);
  return blob ? { blob, filename, label: "Everything" } : null;
}

/** Packs files that are already in memory (e.g. the Word files plus the designed Gamma deck) into one ZIP. */
export async function zipReadyFiles(files: ReadyFile[], filename: string): Promise<ReadyFile> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.filename, f.blob);
  // The files are already compressed (docx/pptx are ZIPs), so storing them keeps this near-instant.
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, filename, label: "Everything" };
}
