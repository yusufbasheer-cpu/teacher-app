"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { GenerationProgressPanel, type GenLineStatus, type GenProgressLine } from "@/components/lesson-plan/generation-progress-panel";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import type {
  LessonPlanInput,
  LessonPlanResult,
  SavedLessonPlan,
  SectionImageMap,
  TeacherPackageSectionKey,
} from "@/lib/lesson-plan";
import {
  CURRICULUM_TYPE_OPTIONS,
  GENERATION_CHECKBOX_LABELS,
  GRADE_YEAR_OPTIONS,
  SUBJECT_OPTIONS,
  TEACHER_PACKAGE_SECTIONS,
  getGenerationTimeEstimate,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
  mergeSectionImagesMeta,
  parseSectionImagesMeta,
} from "@/lib/lesson-plan";
import { parsePptContentIntoSlides } from "@/lib/ppt-slide-parse";
import { CURRICULUM_FRAMEWORK_OPTIONS, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import { supabase } from "@/lib/supabase";

type SourceUploadChunk = {
  id: string;
  fileName: string;
  kind: "pdf" | "image";
  text: string;
};

function combineSourceChunks(chunks: SourceUploadChunk[]): string {
  return chunks
    .map((c) => `===== ${c.fileName} (${c.kind}) =====\n${c.text.trim()}`)
    .join("\n\n")
    .trim();
}

type ExtractPayload = {
  error?: string;
  parts?: { sourceLabel: string; kind: "pdf" | "image"; text: string }[];
  partialErrors?: { sourceLabel: string; message: string }[];
};

function formatExtractUploadFailure(status: number, data: ExtractPayload, raw: string): string {
  const lines: string[] = [];
  const headline = data.error?.trim() || "The extract-upload request failed.";
  lines.push(`[HTTP ${status}] ${headline}`);
  if (data.partialErrors && data.partialErrors.length > 0) {
    lines.push(
      "Per-file details:",
      ...data.partialErrors.map((pe) => `  • ${pe.sourceLabel}: ${pe.message}`),
    );
  }
  if (!data.error && (!data.partialErrors || data.partialErrors.length === 0)) {
    const trimmed = raw.trim();
    if (trimmed) {
      lines.push(`Raw response (truncated):\n${trimmed.slice(0, 800)}`);
    }
  }
  return lines.join("\n");
}

const initialForm: LessonPlanInput = {
  curriculumType: "CBSE/NCERT",
  curriculumFramework: "",
  grade: "Grade 1",
  subject: "Math",
  chapter: "",
  topic: "",
  learningObjectives: "",
};

function initialSectionSelection(): Record<TeacherPackageSectionKey, boolean> {
  return Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, true])) as Record<
    TeacherPackageSectionKey,
    boolean
  >;
}

export function LessonPlanGenerator() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [form, setForm] = useState<LessonPlanInput>(initialForm);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [sectionImages, setSectionImages] = useState<SectionImageMap | null>(null);
  const [sectionImageErrors, setSectionImageErrors] = useState<Partial<
    Record<TeacherPackageSectionKey, string>
  > | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [parallelLoading, setParallelLoading] = useState(false);
  const [progressLines, setProgressLines] = useState<GenProgressLine[]>([]);
  const [downloadsUnlocked, setDownloadsUnlocked] = useState(true);
  const [pptSlideImageUrls, setPptSlideImageUrls] = useState<(string | null)[] | null>(null);
  const latestPlanRef = useRef<LessonPlanResult>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [sectionSelection, setSectionSelection] =
    useState<Record<TeacherPackageSectionKey, boolean>>(initialSectionSelection);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedChunks, setUploadedChunks] = useState<SourceUploadChunk[]>([]);
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadExtractionError, setUploadExtractionError] = useState<string | null>(null);

  const extractedMaterialPreview = useMemo(
    () => combineSourceChunks(uploadedChunks),
    [uploadedChunks],
  );

  const loadPlanById = async (userId: string, planId: string) => {
    const { data, error: loadError } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("id", planId)
      .single();

    if (loadError) {
      throw new Error(loadError.message);
    }

    const plan = data as SavedLessonPlan;
    const ct = plan.curriculum_type?.trim();
    const loadedCurriculum =
      ct && isValidCurriculumType(ct) ? ct : CURRICULUM_TYPE_OPTIONS[CURRICULUM_TYPE_OPTIONS.length - 1]!;
    const g = plan.grade?.trim();
    const loadedGrade = g && isValidGradeYear(g) ? g : GRADE_YEAR_OPTIONS[0]!;
    const subj = plan.subject?.trim();
    const loadedSubject =
      subj && isValidSubjectOption(subj) ? subj : SUBJECT_OPTIONS[SUBJECT_OPTIONS.length - 1]!;
    const fw = plan.curriculum_framework?.trim();
    const loadedFramework =
      fw && isValidCurriculumFramework(fw) ? fw : "";
    setForm({
      curriculumType: loadedCurriculum,
      curriculumFramework: loadedFramework,
      grade: loadedGrade,
      subject: loadedSubject,
      chapter: plan.chapter ?? "",
      topic: plan.topic,
      learningObjectives: plan.learning_objectives,
    });
    const { planTextOnly, sectionImages: loadedImages } = parseSectionImagesMeta(plan.lesson_plan);
    setLessonPlan(planTextOnly);
    setSectionImages(Object.keys(loadedImages).length > 0 ? loadedImages : null);
    setSectionImageErrors(null);
    setActivePlanId(plan.id);
    setDownloadsUnlocked(true);
    setPptSlideImageUrls(null);
    setProgressLines([]);
    setUploadedChunks([]);
    setUploadInfo(null);
    setUploadWarnings([]);
    setUploadExtractionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        const planId = searchParams.get("planId");
        if (planId) {
          try {
            await loadPlanById(sessionUser.id, planId);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed loading plan.");
          }
        }
      }
      setCheckingAuth(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setActivePlanId(null);
        setLessonPlan(null);
        setSectionImages(null);
        setSectionImageErrors(null);
        setParallelLoading(false);
        setProgressLines([]);
        setPptSlideImageUrls(null);
        setDownloadsUnlocked(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const clearUploadedSource = () => {
    setUploadedChunks([]);
    setUploadInfo(null);
    setUploadWarnings([]);
    setUploadExtractionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeUploadedChunk = (id: string) => {
    setUploadedChunks((prev) => prev.filter((c) => c.id !== id));
    setUploadInfo(null);
    setUploadWarnings([]);
    setUploadExtractionError(null);
  };

  const onUploadFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) {
      console.log("[lesson-plan upload] onChange skipped: no files in event");
      return;
    }

    const files = Array.from(list);
    console.log("[lesson-plan upload] start", {
      fileCount: files.length,
      names: files.map((f) => f.name),
      sizes: files.map((f) => f.size),
      types: files.map((f) => f.type),
    });

    const isAllowed = (file: File) => {
      const lower = file.name.toLowerCase();
      const allowedExt =
        lower.endsWith(".pdf") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png");
      const allowedMime =
        file.type === "application/pdf" ||
        file.type === "image/jpeg" ||
        file.type === "image/png";
      return allowedExt || allowedMime;
    };
    const invalid = files.filter((f) => !isAllowed(f));
    if (invalid.length > 0) {
      const msg = `Unsupported file type(s): ${invalid.map((f) => f.name).join(", ")}. Use PDF, JPG, or PNG only.`;
      console.error("[lesson-plan upload] validation failed", msg);
      setUploadExtractionError(msg);
      e.target.value = "";
      return;
    }

    setUploadExtracting(true);
    setError(null);
    setUploadExtractionError(null);
    setUploadInfo(null);
    setUploadWarnings([]);

    const inputEl = e.target;

    try {
      const fd = new FormData();
      for (const file of files) {
        fd.append("files", file);
      }
      console.log("[lesson-plan upload] posting FormData to /api/lesson-plan/extract-upload");

      const res = await fetch("/api/lesson-plan/extract-upload", {
        method: "POST",
        body: fd,
      });

      const raw = await res.text();
      console.log("[lesson-plan upload] response", {
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get("content-type"),
        rawLength: raw.length,
        rawPreview: raw.slice(0, 300),
      });

      let data: ExtractPayload;
      try {
        data = JSON.parse(raw) as ExtractPayload;
      } catch (parseErr) {
        console.error("[lesson-plan upload] JSON parse failed", parseErr, { rawPreview: raw.slice(0, 500) });
        setUploadExtractionError(
          `Could not parse server response as JSON (HTTP ${res.status}). First bytes:\n${raw.trim().slice(0, 600)}`,
        );
        return;
      }

      if (!res.ok) {
        const msg = formatExtractUploadFailure(res.status, data, raw);
        console.error("[lesson-plan upload] non-OK response", msg);
        setUploadExtractionError(msg);
        return;
      }

      const parts = data.parts ?? [];
      if (parts.length === 0) {
        const msg =
          formatExtractUploadFailure(res.status, data, raw) +
          "\n\n(Unexpected: HTTP 200 but no parts[] in JSON.)";
        console.error("[lesson-plan upload] empty parts", data);
        setUploadExtractionError(msg);
        return;
      }

      const newChunks: SourceUploadChunk[] = parts.map((p) => ({
        id: crypto.randomUUID(),
        fileName: p.sourceLabel,
        kind: p.kind,
        text: p.text,
      }));
      console.log("[lesson-plan upload] success", {
        newChunkCount: newChunks.length,
        charCounts: newChunks.map((c) => c.text.length),
      });

      setUploadedChunks((prev) => [...prev, ...newChunks]);

      const addedChars = newChunks.reduce((n, c) => n + c.text.length, 0);
      setUploadInfo(
        `Content extracted successfully. Added ${newChunks.length} file(s) from this batch (${addedChars.toLocaleString()} characters). Review the preview below before generating.`,
      );
      if (data.partialErrors?.length) {
        setUploadWarnings(
          data.partialErrors.map((pe) => `${pe.sourceLabel}: ${pe.message}`),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[lesson-plan upload] thrown error", err);
      setUploadExtractionError(
        `${msg}${err instanceof Error && err.stack ? `\n\n${err.stack}` : ""}`.slice(0, 4000),
      );
    } finally {
      setUploadExtracting(false);
      window.setTimeout(() => {
        inputEl.value = "";
        console.log("[lesson-plan upload] file input cleared (deferred)");
      }, 0);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setPptSlideImageUrls(null);
    setDownloadsUnlocked(false);
    setActivePlanId(null);
    latestPlanRef.current = {};
    setLessonPlan({});
    setSectionImages(null);
    setSectionImageErrors(null);

    const sections = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]);
    if (sections.length === 0) {
      setError("Select at least one item to generate.");
      return;
    }

    const initialLines: GenProgressLine[] = sections.map((s) => ({
      key: s,
      label: GENERATION_CHECKBOX_LABELS[s],
      status: "running" as const,
      detail: "Generating…",
    }));
    if (sections.includes("PPT Slide Content")) {
      initialLines.push({
        key: "ppt-slide-images",
        label: "Slide images (PPT)",
        status: "pending",
        detail: "Waiting for slide content…",
      });
    }
    setProgressLines(initialLines);
    setParallelLoading(true);

    const pptUrlsRef: { current: (string | null)[] | null } = { current: null };

    const updateLine = (key: string, status: GenLineStatus, detail?: string) => {
      setProgressLines((prev) =>
        prev.map((l) =>
          l.key === key
            ? {
                ...l,
                status,
                ...(detail !== undefined ? { detail } : {}),
              }
            : l,
        ),
      );
    };

    const combinedSource = combineSourceChunks(uploadedChunks);
    const basePayload = {
      ...form,
      ...(combinedSource.length > 0 ? { sourceMaterial: combinedSource } : {}),
    };

    const runSection = async (section: TeacherPackageSectionKey) => {
      try {
        const res = await fetch("/api/lesson-plan/section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, section }),
        });
        const data = (await res.json()) as {
          error?: string;
          text?: string;
          sectionImageUrls?: string[];
          sectionImageError?: string;
        };
        if (!res.ok) {
          updateLine(section, "error", data.error ?? "Request failed");
          if (section === "PPT Slide Content") {
            updateLine("ppt-slide-images", "error", "PPT text not generated");
          }
          throw new Error(data.error ?? `Section "${section}" failed.`);
        }
        const text = data.text ?? "";
        latestPlanRef.current = { ...latestPlanRef.current, [section]: text };
        setLessonPlan({ ...latestPlanRef.current });
        if (data.sectionImageUrls && data.sectionImageUrls.length > 0) {
          setSectionImages((prev) => ({
            ...(prev ?? {}),
            [section]: data.sectionImageUrls,
          }));
        }
        if (data.sectionImageError) {
          setSectionImageErrors((prev) => ({
            ...(prev ?? {}),
            [section]: data.sectionImageError,
          }));
        }
        updateLine(section, "done", "Done ✅");

        if (section === "PPT Slide Content") {
          const slides = parsePptContentIntoSlides(text);
          const total = slides.length;
          if (total === 0) {
            updateLine("ppt-slide-images", "done", "Done ✅ (0 slides)");
            pptUrlsRef.current = [];
            setPptSlideImageUrls([]);
            return;
          }
          updateLine("ppt-slide-images", "running", `0 of ${total}`);
          const urls: (string | null)[] = new Array(total).fill(null);
          const counter = { n: 0 };
          await Promise.all(
            slides.map(async (_, i) => {
              try {
                const ir = await fetch("/api/lesson-plan/ppt-slide-image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subject: form.subject,
                    grade: form.grade,
                    topic: form.topic,
                    ...(form.curriculumFramework.trim()
                      ? { curriculumFramework: form.curriculumFramework.trim() }
                      : {}),
                    pptContent: text,
                    slideIndex: i,
                  }),
                });
                const ij = (await ir.json()) as { url?: string | null };
                urls[i] = typeof ij.url === "string" && ij.url.length > 0 ? ij.url : null;
              } catch {
                urls[i] = null;
              } finally {
                counter.n += 1;
                updateLine("ppt-slide-images", "running", `${counter.n} of ${total}`);
              }
            }),
          );
          pptUrlsRef.current = urls;
          setPptSlideImageUrls(urls);
          const ok = urls.filter(Boolean).length;
          updateLine("ppt-slide-images", "done", `Done ✅ (${ok}/${total})`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateLine(section, "error", msg.slice(0, 160));
        if (section === "PPT Slide Content") {
          updateLine("ppt-slide-images", "error", "Skipped");
        }
        throw e;
      }
    };

    try {
      const results = await Promise.allSettled(sections.map((s) => runSection(s)));
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === results.length) {
        setError("Every section failed to generate. Check the progress list and try again.");
      } else if (failed.length > 0) {
        setError("Some sections failed; successful parts are still available below.");
      }

      if (sections.includes("PPT Slide Content") && pptUrlsRef.current === null) {
        pptUrlsRef.current = [];
        setPptSlideImageUrls([]);
      }
      setDownloadsUnlocked(sections.every((s) => Boolean(latestPlanRef.current[s]?.trim())));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
    } finally {
      setParallelLoading(false);
    }
  };

  const onSaveLessonPlan = async () => {
    if (!user || !lessonPlan || Object.keys(lessonPlan).length === 0) return;
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        curriculum_type: form.curriculumType,
        curriculum_framework: form.curriculumFramework.trim() || "",
        subject: form.subject,
        grade: form.grade,
        chapter: form.chapter.trim(),
        topic: form.topic,
        learning_objectives: form.learningObjectives,
        lesson_plan: mergeSectionImagesMeta(lessonPlan, sectionImages),
      };

      if (activePlanId) {
        const { error: updateError } = await supabase
          .from("lesson_plans")
          .update(payload)
          .eq("id", activePlanId)
          .eq("user_id", user.id);
        if (updateError) throw new Error(updateError.message);
        setSuccessMessage("Lesson plan updated successfully.");
      } else {
        const { data, error: insertError } = await supabase
          .from("lesson_plans")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        const newId = (data as { id: string }).id;
        setActivePlanId(newId);
        setSuccessMessage("Lesson plan saved successfully.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lesson plan.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Checking your account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Please login to generate and save your personal lesson plans.
        </p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  const selectedSectionCount = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]).length;
  const generationEta = getGenerationTimeEstimate(selectedSectionCount);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        Signed in as <span className="font-semibold">{user.email}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={onSubmit}
          aria-busy={parallelLoading}
          className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7"
        >
          <h2 className="text-xl font-semibold text-slate-900">Lesson Plan Generator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fill in class details, choose which materials to generate, then run the AI.
          </p>

        <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm font-semibold text-blue-950">
            Upload a PDF or image to generate resources from your own content.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            You can select <strong>multiple PDFs and images in one go</strong> (Ctrl/Cmd+click or
            shift-select). Each file may be up to 12 MB; total up to 48 MB and 24 files per batch.
            Text is extracted from PDFs; JPG and PNG use on-server OCR (Tesseract.js). Everything you
            keep below is combined
            and sent to the AI when you generate.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={onUploadFileChange}
              disabled={uploadExtracting || parallelLoading}
              className="block w-full min-w-0 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800 disabled:opacity-60 sm:w-auto"
            />
            {uploadedChunks.length > 0 ? (
              <button
                type="button"
                onClick={clearUploadedSource}
                disabled={uploadExtracting || parallelLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Clear all uploads
              </button>
            ) : null}
          </div>
          {uploadExtracting ? (
            <p className="mt-2 text-xs font-medium text-blue-800">
              Extracting text from your files…
            </p>
          ) : null}
          {uploadExtractionError ? (
            <div
              role="alert"
              className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 whitespace-pre-wrap"
            >
              {uploadExtractionError}
            </div>
          ) : null}
          {uploadInfo ? (
            <p className="mt-2 text-xs font-medium text-emerald-800">{uploadInfo}</p>
          ) : null}
          {uploadWarnings.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs font-medium text-amber-900">
              {uploadWarnings.map((w, i) => (
                <li key={`warn-${i}`}>{w}</li>
              ))}
            </ul>
          ) : null}
          {uploadedChunks.length > 0 ? (
            <ul className="mt-3 divide-y divide-blue-100 rounded-lg border border-blue-100 bg-white/90">
              {uploadedChunks.map((chunk) => (
                <li
                  key={chunk.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{chunk.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {chunk.kind === "pdf" ? "PDF" : "Image"} ·{" "}
                      {chunk.text.length.toLocaleString()} characters
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedChunk(chunk.id)}
                    disabled={uploadExtracting || parallelLoading}
                    className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uploadedChunks.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Combined:{" "}
              {extractedMaterialPreview.length.toLocaleString()} characters across{" "}
              {uploadedChunks.length} file(s).
            </p>
          ) : null}
          {extractedMaterialPreview.length > 0 ? (
            <div className="mt-4">
              <label
                htmlFor="extracted-upload-preview"
                className="mb-1 block text-xs font-semibold text-slate-800"
              >
                Extracted content (review before generating)
              </label>
              <textarea
                id="extracted-upload-preview"
                readOnly
                value={extractedMaterialPreview}
                rows={12}
                spellCheck={false}
                className="max-h-80 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 outline-none ring-blue-500 focus:ring-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                This text is what the AI will use as your uploaded source material when you click
                Generate.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="curriculum" className="mb-1 block text-sm font-medium text-slate-700">
              Curriculum type
            </label>
            <select
              id="curriculum"
              value={form.curriculumType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, curriculumType: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              required
            >
              {CURRICULUM_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Curriculum Framework
            </p>
            <label
              htmlFor="curriculum-framework"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Select Educational Framework (Optional)
            </label>
            <select
              id="curriculum-framework"
              value={form.curriculumFramework}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, curriculumFramework: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2"
            >
              {CURRICULUM_FRAMEWORK_OPTIONS.map((opt) => (
                <option key={opt.value === "" ? "none" : opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Leave as &quot;None&quot; for a standard plan. Choosing a framework aligns lesson plan,
              slides, worksheet, assessment, homework, and teacher notes with that system&apos;s
              expectations.
            </p>
          </div>

          <div>
            <label htmlFor="grade-year" className="mb-1 block text-sm font-medium text-slate-700">
              Grade / year group
            </label>
            <select
              id="grade-year"
              value={form.grade}
              onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              required
            >
              {GRADE_YEAR_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <select
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              required
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="chapter" className="mb-1 block text-sm font-medium text-slate-700">
              Chapter name or number
            </label>
            <input
              id="chapter"
              type="text"
              value={form.chapter}
              onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="e.g. Chapter 5 - Photosynthesis"
            />
          </div>

          <div>
            <label htmlFor="topic" className="mb-1 block text-sm font-medium text-slate-700">
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Specific topic within the chapter"
              required
            />
          </div>

          <div>
            <label
              htmlFor="objectives"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Learning objectives
            </label>
            <textarea
              id="objectives"
              value={form.learningObjectives}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, learningObjectives: e.target.value }))
              }
              className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="List key outcomes students should achieve."
              required
            />
          </div>
        </div>

        <fieldset className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">What to generate</legend>
          <p className="mt-1 text-xs text-slate-600">
            Only checked sections are sent to the AI — fewer selections usually means a quicker response.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSectionSelection(
                  Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, true])) as Record<
                    TeacherPackageSectionKey,
                    boolean
                  >,
                )
              }
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() =>
                setSectionSelection(
                  Object.fromEntries(TEACHER_PACKAGE_SECTIONS.map((k) => [k, false])) as Record<
                    TeacherPackageSectionKey,
                    boolean
                  >,
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Deselect All
            </button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {TEACHER_PACKAGE_SECTIONS.map((key) => (
              <li key={key} className="flex items-start gap-3">
                <input
                  id={`gen-${key}`}
                  type="checkbox"
                  checked={sectionSelection[key]}
                  onChange={() =>
                    setSectionSelection((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                />
                <label htmlFor={`gen-${key}`} className="text-sm text-slate-800">
                  {GENERATION_CHECKBOX_LABELS[key]}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Estimated time: </span>
          {selectedSectionCount === 0 ? (
            generationEta.detail
          ) : (
            <>
              {generationEta.tier} ({generationEta.detail}) — {selectedSectionCount} item
              {selectedSectionCount === 1 ? "" : "s"} selected
            </>
          )}
        </p>

        <button
          type="submit"
          disabled={
            parallelLoading ||
            uploadExtracting ||
            TEACHER_PACKAGE_SECTIONS.every((k) => !sectionSelection[k])
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {parallelLoading ? "Generating..." : "Generate Lesson Plan"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7">
        <h3 className="text-xl font-semibold text-slate-900">Generated teacher package</h3>
        <p className="mt-2 text-sm text-slate-600">
          Preview and download only the sections you generated (lesson plan, slides, worksheet, and
          more). When <code className="rounded bg-slate-100 px-1">FAL_API_KEY</code> is set, FLUX.1
          illustrations appear beside each section.
        </p>

        {lessonPlan === null && !parallelLoading ? (
          <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-sm text-slate-500">
            No lesson plan generated yet.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {parallelLoading && progressLines.length > 0 ? (
              <GenerationProgressPanel lines={progressLines} />
            ) : null}
            <button
              type="button"
              onClick={onSaveLessonPlan}
              disabled={saving || parallelLoading}
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Lesson Plan"}
            </button>
            <TeacherPackageViewer
              lessonPlan={lessonPlan ?? {}}
              sectionImages={sectionImages ?? undefined}
              sectionImageErrors={sectionImageErrors ?? undefined}
              subject={form.subject}
              grade={form.grade}
              topic={form.topic}
              curriculumFramework={form.curriculumFramework.trim() || undefined}
              downloadsUnlocked={downloadsUnlocked}
              cachedSlideImageUrls={pptSlideImageUrls ?? undefined}
              generationActive={parallelLoading && Object.keys(lessonPlan ?? {}).length === 0}
            />
          </div>
        )}
        </section>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {successMessage}
        </div>
      ) : null}

    </div>
  );
}
