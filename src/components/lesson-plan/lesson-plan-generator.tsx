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
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LessonPlanLoadingGame } from "@/components/lesson-plan/lesson-plan-loading-game";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import type {
  LessonPlanInput,
  LessonPlanResult,
  SavedLessonPlan,
  SectionImageMap,
  TeacherPackageSectionKey,
} from "@/lib/lesson-plan";
import {
  CORE_SUBJECT_OPTIONS,
  CURRICULUM_TYPE_OPTIONS,
  GENERATION_CHECKBOX_LABELS,
  GRADE_YEAR_OPTIONS,
  LANGUAGE_SUBJECT_OPTIONS,
  SUBJECT_OPTIONS,
  TEACHER_PACKAGE_SECTIONS,
  buildDifferentiatedPackSourceText,
  buildGenerationSourceMaterial,
  getGenerationTimeEstimate,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
  mergeSectionImagesMeta,
  parseSectionImagesMeta,
} from "@/lib/lesson-plan";
import { writeDiffPackSession } from "@/lib/differentiated-pack-session";
import { CURRICULUM_FRAMEWORK_OPTIONS, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  DEFAULT_PPT_THEME_ID,
  PPT_THEME_CARDS,
  type PptThemeId,
} from "@/lib/ppt-themes";
import { supabase } from "@/lib/supabase";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import {
  AFL_PHASE_GROUPS,
  AFL_PHASE_IDS,
  AFL_RECOMMENDED_IDS,
  type AflPhaseId,
} from "@/lib/afl-tools";

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

function emptyAflSelected(): Record<AflPhaseId, string[]> {
  return Object.fromEntries(AFL_PHASE_IDS.map((p) => [p, [] as string[]])) as Record<
    AflPhaseId,
    string[]
  >;
}

function toAflPayload(map: Record<AflPhaseId, string[]>) {
  const out: Partial<Record<AflPhaseId, string[]>> = {};
  for (const p of AFL_PHASE_IDS) {
    const arr = map[p]?.filter(Boolean) ?? [];
    if (arr.length) out[p] = arr;
  }
  return out;
}

export function LessonPlanGenerator() {
  const router = useRouter();
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
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [sectionSelection, setSectionSelection] =
    useState<Record<TeacherPackageSectionKey, boolean>>(initialSectionSelection);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadedChunks, setUploadedChunks] = useState<SourceUploadChunk[]>([]);
  const [pastedContent, setPastedContent] = useState("");
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadExtractionError, setUploadExtractionError] = useState<string | null>(null);

  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [pptThemeId, setPptThemeId] = useState<PptThemeId>(DEFAULT_PPT_THEME_ID);
  const [aflPanelOpen, setAflPanelOpen] = useState(false);
  const [aflSelected, setAflSelected] = useState<Record<AflPhaseId, string[]>>(() => emptyAflSelected());

  const extractedMaterialPreview = useMemo(
    () => combineSourceChunks(uploadedChunks),
    [uploadedChunks],
  );

  const combinedSourcePreview = useMemo(
    () =>
      buildGenerationSourceMaterial({
        pastedContent,
        uploadedExtractedText: extractedMaterialPreview,
      }) ?? "",
    [pastedContent, extractedMaterialPreview],
  );

  const aflSelectionsPayload = useMemo(() => toAflPayload(aflSelected), [aflSelected]);
  const hasAflForExport = Object.keys(aflSelectionsPayload).length > 0;

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
    setUploadedChunks([]);
    setUploadInfo(null);
    setUploadWarnings([]);
    setUploadExtractionError(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
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
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const clearPastedContent = () => {
    setPastedContent("");
  };

  const removeUploadedChunk = (id: string) => {
    setUploadedChunks((prev) => prev.filter((c) => c.id !== id));
    setUploadInfo(null);
    setUploadWarnings([]);
    setUploadExtractionError(null);
  };

  const onUploadFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    allowedKind: "pdf" | "image",
  ) => {
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
      if (allowedKind === "pdf") {
        return lower.endsWith(".pdf") || file.type === "application/pdf";
      }
      return (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        file.type === "image/jpeg" ||
        file.type === "image/png"
      );
    };
    const invalid = files.filter((f) => !isAllowed(f));
    if (invalid.length > 0) {
      const msg =
        allowedKind === "pdf"
          ? `Unsupported file type(s): ${invalid.map((f) => f.name).join(", ")}. Use PDF only for Option 1.`
          : `Unsupported file type(s): ${invalid.map((f) => f.name).join(", ")}. Use JPG or PNG only for Option 2.`;
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
    setParseNotice(null);
    setGenerationProgress(null);
    setLessonPlan(null);
    setSectionImages(null);
    setSectionImageErrors(null);
    setActivePlanId(null);

    const sections = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]);
    if (sections.length === 0) {
      setError("Select at least one item to generate.");
      return;
    }

    setLoading(true);
    setGenerationProgress(null);

    try {
      const combinedSource = combineSourceChunks(uploadedChunks);
      const pasted = pastedContent.trim();
      const pptSelected = sectionSelection["PPT Slide Content"];
      const response = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sections,
          ...(hasAflForExport ? { aflSelections: aflSelectionsPayload } : {}),
          ...(combinedSource.length > 0 ? { sourceMaterial: combinedSource } : {}),
          ...(pasted.length > 0 ? { pastedContent: pasted } : {}),
          ...(pptSelected ? { streamProgress: true } : {}),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      type LessonPlanApiResponse = {
        error?: string;
        lessonPlan?: LessonPlanResult;
        parseNotice?: string;
        sectionImages?: SectionImageMap;
        sectionImageErrors?: Partial<Record<TeacherPackageSectionKey, string>>;
        rawResponse?: string;
      };

      const applySuccessPayload = (data: LessonPlanApiResponse) => {
        if (!data.lessonPlan) {
          throw new Error(
            (data.error ?? "No lesson plan returned.") +
              (typeof data.rawResponse === "string" && data.rawResponse.trim()
                ? `\n\n--- Raw response ---\n${data.rawResponse}`
                : ""),
          );
        }
        setLessonPlan(data.lessonPlan);
        setParseNotice(typeof data.parseNotice === "string" && data.parseNotice.trim() ? data.parseNotice.trim() : null);
        setSectionImages(
          data.sectionImages && Object.keys(data.sectionImages).length > 0 ? data.sectionImages : null,
        );
        setSectionImageErrors(
          data.sectionImageErrors && Object.keys(data.sectionImageErrors).length > 0
            ? data.sectionImageErrors
            : null,
        );
        if (data.sectionImageErrors && Object.keys(data.sectionImageErrors).length > 0) {
          console.warn("[lesson-plan] section image errors from API:", data.sectionImageErrors);
        }
      };

      if (response.ok && pptSelected && contentType.includes("application/x-ndjson")) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("The server returned an NDJSON stream but no response body was available.");
        }
        const decoder = new TextDecoder();
        let buffer = "";
        let completePayload: LessonPlanApiResponse | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line) as Record<string, unknown>;
            } catch {
              console.warn("[lesson-plan client] skipped non-JSON NDJSON line:", line.slice(0, 200));
              continue;
            }
            const t = ev.type;
            if (t === "progress" && typeof ev.message === "string") {
              setGenerationProgress(ev.message);
            } else if (t === "error" && typeof ev.message === "string") {
              throw new Error(ev.message);
            } else if (t === "complete") {
              completePayload = ev as unknown as LessonPlanApiResponse;
            }
          }
        }
        if (!completePayload?.lessonPlan) {
          throw new Error(
            "Stream ended without a complete lesson package. Please try again or deselect PPT to use the non-streaming path.",
          );
        }
        applySuccessPayload(completePayload);
      } else {
        const raw = await response.text();
        console.log("[lesson-plan client] /api/lesson-plan HTTP", response.status, "body length", raw.length);
        console.log("[lesson-plan client] raw preview:\n", raw.slice(0, 2500));

        const parsed = tryParseApiJson<LessonPlanApiResponse>(raw, response.status);
        if (!parsed.ok) {
          throw new Error(
            `${parsed.message}\n\n--- Raw response (truncated) ---\n${parsed.rawPreview || "(empty)"}`,
          );
        }
        const data = parsed.data;

        if (!response.ok) {
          const extra =
            typeof data.rawResponse === "string" && data.rawResponse.trim()
              ? `\n\n--- Raw response from server ---\n${data.rawResponse}`
              : "";
          throw new Error(
            (data.error ?? `Failed to generate lesson plan (HTTP ${response.status}).`) + extra,
          );
        }

        applySuccessPayload(data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(message);
      setParseNotice(null);
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

  const onSaveLessonPlan = async () => {
    if (!user || !lessonPlan) return;
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

  const onSendToDifferentiatedPack = () => {
    if (!lessonPlan) return;
    setError(null);
    const { planTextOnly } = parseSectionImagesMeta(lessonPlan);
    const lessonSourceText = buildDifferentiatedPackSourceText(planTextOnly);
    if (!lessonSourceText.trim()) {
      setError(
        "Your package has no text sections yet. Generate at least one section (for example the lesson plan), then try again.",
      );
      return;
    }
    writeDiffPackSession({
      topic: form.topic.trim(),
      subject: form.subject.trim(),
      grade: form.grade.trim(),
      learningObjectives: form.learningObjectives.trim(),
      curriculumType: form.curriculumType.trim() || undefined,
      curriculumFramework: form.curriculumFramework.trim() || undefined,
      lessonSourceText,
    });
    router.push("/differentiated-worksheets");
  };

  if (checkingAuth) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Checking your account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Please login to generate and save your personal lesson plans.
        </p>
        <Link
          href="/auth"
          className="mt-5 inline-flex rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
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
      <div className="rounded-2xl border border-[#00C6A7]/20 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
        Signed in as <span className="font-semibold">{user.email}</span>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <form
          onSubmit={onSubmit}
          aria-busy={loading}
          className="min-w-0 rounded-3xl border border-[#00C6A7]/20 bg-white p-5 shadow-sm sm:p-6 md:p-7"
        >
          <h2 className="text-xl font-semibold text-slate-900">Lesson Plan Generator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fill in class details, choose which materials to generate, then run the AI.
          </p>

        <div className="mt-6 rounded-2xl border border-dashed border-[#00C6A7]/30 bg-[#00C6A7]/5 p-4 space-y-5">
          <div>
            <p className="text-sm font-semibold text-[#0A1628]">
              Provide your own teaching content (optional)
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Use any combination of PDF upload, image upload, or pasted text. Pasted content is
              treated as the <strong>primary</strong> source when present.
            </p>
          </div>

          <div className="rounded-xl border border-[#00C6A7]/20 bg-white/80 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Option 1 — Upload PDF
            </p>
            <input
              ref={pdfInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={(e) => onUploadFileChange(e, "pdf")}
              disabled={uploadExtracting || loading}
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00C6A7] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#0A8F7A] disabled:opacity-60"
            />
          </div>

          <div className="rounded-xl border border-[#00C6A7]/20 bg-white/80 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Option 2 — Upload Image
            </p>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={(e) => onUploadFileChange(e, "image")}
              disabled={uploadExtracting || loading}
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00C6A7] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#0A8F7A] disabled:opacity-60"
            />
          </div>

          <div className="rounded-xl border border-[#00C6A7]/20 bg-white/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Option 3 — Paste Your Content
              </p>
              {pastedContent.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={clearPastedContent}
                  disabled={uploadExtracting || loading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear pasted content
                </button>
              ) : null}
            </div>
            <label htmlFor="pasted-content" className="mt-2 block text-sm font-medium text-slate-800">
              Paste Your Own Content Here (Optional)
            </label>
            <textarea
              id="pasted-content"
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              disabled={uploadExtracting || loading}
              rows={8}
              placeholder="Paste your textbook content, notes, chapter text, or any material here and the AI will generate all resources based on your content."
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#00C6A7] focus:ring-2 disabled:opacity-60"
            />
          </div>

          {uploadedChunks.length > 0 ? (
            <button
              type="button"
              onClick={clearUploadedSource}
              disabled={uploadExtracting || loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Clear all uploads
            </button>
          ) : null}
          {uploadExtracting ? (
            <p className="mt-2 text-xs font-medium text-[#0A1628]">
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
            <ul className="mt-3 divide-y divide-[#00C6A7]/20 rounded-lg border border-[#00C6A7]/20 bg-white/90">
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
                    disabled={uploadExtracting || loading}
                    className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uploadedChunks.length > 0 ? (
            <p className="text-xs text-slate-500">
              Uploads: {extractedMaterialPreview.length.toLocaleString()} characters across{" "}
              {uploadedChunks.length} file(s).
            </p>
          ) : null}
          {combinedSourcePreview.length > 0 ? (
            <div className="mt-2">
              <label
                htmlFor="combined-source-preview"
                className="mb-1 block text-xs font-semibold text-slate-800"
              >
                Combined source preview (review before generating)
              </label>
              <textarea
                id="combined-source-preview"
                readOnly
                value={combinedSourcePreview}
                rows={12}
                spellCheck={false}
                className="max-h-80 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 outline-none ring-[#00C6A7] focus:ring-2"
              />
              <p className="mt-1 text-xs text-slate-500">
                {pastedContent.trim().length > 0
                  ? "Pasted content is sent as the primary source; uploads are included as supplementary context."
                  : "Uploaded extract text sent to the AI when you click Generate."}
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#00C6A7] focus:ring-2"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
              required
            >
              <optgroup label="Subjects">
                {CORE_SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Language Subjects">
                {LANGUAGE_SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </optgroup>
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
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
              className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2"
              placeholder="List key outcomes students should achieve."
              required
            />
          </div>
        </div>

        {!aflPanelOpen ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setAflPanelOpen(true)}
              className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100"
            >
              Add AFL Tools to Your Lesson
              <span className="mt-1 block text-xs font-normal text-violet-800/90">
                Optional: pick Assessment for Learning tools by lesson phase. They are sent to the AI
                and appear in your lesson plan and PowerPoint.
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50/80 to-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-3 border-b border-violet-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Select AFL Tools for Your Lesson
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Tick the tools you want in each phase. They are woven into the written plan and
                  matched slides when you generate.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAflSelected(
                      Object.fromEntries(
                        AFL_PHASE_IDS.map((phase) => {
                          const allowed = new Set(
                            AFL_PHASE_GROUPS.find((g) => g.phase === phase)?.tools.map((t) => t.id) ??
                              [],
                          );
                          const ids = AFL_RECOMMENDED_IDS[phase].filter((id) => allowed.has(id));
                          return [phase, [...ids]];
                        }),
                      ) as Record<AflPhaseId, string[]>,
                    );
                  }}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
                >
                  Select Recommended
                </button>
                <button
                  type="button"
                  onClick={() => setAflSelected(emptyAflSelected())}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setAflPanelOpen(false)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-[min(70vh,520px)] space-y-5 overflow-y-auto pr-1">
              {AFL_PHASE_GROUPS.map((group) => (
                <fieldset key={group.phase} className="rounded-xl border border-slate-200 bg-white/90 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-violet-800">
                    {group.title}
                  </legend>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.tools.map((t) => {
                      const checked = (aflSelected[group.phase] ?? []).includes(t.id);
                      return (
                        <li key={t.id} className="flex items-start gap-2">
                          <input
                            id={`afl-${t.id}`}
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setAflSelected((prev) => {
                                const cur = prev[group.phase] ?? [];
                                const next = on
                                  ? [...new Set([...cur, t.id])]
                                  : cur.filter((id) => id !== t.id);
                                return { ...prev, [group.phase]: next };
                              });
                            }}
                            className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-violet-700 focus:ring-violet-500"
                          />
                          <label htmlFor={`afl-${t.id}`} className="min-w-0 text-sm leading-snug text-slate-800">
                            <span className="font-medium">{t.label}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">{t.purpose}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              ))}
            </div>
          </div>
        )}

        <fieldset className="mt-6 rounded-2xl border border-[#00C6A7]/20 bg-[#00C6A7]/5 p-4">
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
              className="rounded-lg border border-[#00C6A7]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A1628] shadow-sm hover:bg-[#00C6A7]/10"
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
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-[#00C6A7] focus:ring-[#00C6A7]"
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
            loading ||
            uploadExtracting ||
            TEACHER_PACKAGE_SECTIONS.every((k) => !sectionSelection[k])
          }
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#00C6A7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0A8F7A] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Generating..." : "Generate Lesson Plan"}
        </button>

        {error ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-red-600">{error}</p>
        ) : null}
        </form>

        <section className="min-w-0 rounded-3xl border border-[#00C6A7]/20 bg-white p-5 shadow-sm sm:p-6 md:p-7">
        <h3 className="text-xl font-semibold text-slate-900">Generated teacher package</h3>
        <p className="mt-2 text-sm text-slate-600">
          Preview and download only the sections you generated (lesson plan, slides, worksheet, and
          more). When <code className="rounded bg-slate-100 px-1">FAL_API_KEY</code> is set, FLUX.1
          illustrations appear beside each section.
        </p>

        {!lessonPlan ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#00C6A7]/30 bg-[#00C6A7]/5 p-6 text-sm text-slate-500">
            No lesson plan generated yet.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {parseNotice ? (
              <p
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                {parseNotice}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onSaveLessonPlan}
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#00C6A7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0A8F7A] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {saving ? "Saving..." : "Save Lesson Plan"}
            </button>
            <button
              type="button"
              onClick={onSendToDifferentiatedPack}
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-100 sm:w-auto"
            >
              Generate Differentiated Worksheet Pack
            </button>
            </div>
            {typeof lessonPlan["PPT Slide Content"] === "string" &&
            lessonPlan["PPT Slide Content"].trim().length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-inner md:p-5">
                <p className="text-sm font-semibold text-slate-900">Presentation theme</p>
                <p className="mt-1 text-xs text-slate-600">
                  Pick a style for your PowerPoint, then use Download PPT. Ocean Blue is selected by default.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" role="list">
                  {PPT_THEME_CARDS.map((t) => {
                    const selected = pptThemeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="listitem"
                        onClick={() => setPptThemeId(t.id)}
                        aria-pressed={selected}
                        className={`rounded-xl border-2 bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                          selected
                            ? "border-[#00C6A7] ring-2 ring-[#00C6A7]/30 ring-offset-2 ring-offset-slate-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="mb-2 flex gap-1 overflow-hidden rounded-lg" aria-hidden>
                          {t.preview.map((hex) => (
                            <span
                              key={hex}
                              className="h-7 min-w-0 flex-1"
                              style={{ backgroundColor: `#${hex}` }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Theme {t.themeNumber}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-600">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <TeacherPackageViewer
              lessonPlan={lessonPlan}
              sectionImages={sectionImages ?? undefined}
              sectionImageErrors={sectionImageErrors ?? undefined}
              subject={form.subject}
              grade={form.grade}
              topic={form.topic}
              curriculumFramework={form.curriculumFramework.trim() || undefined}
              pptThemeId={pptThemeId}
              learningObjectives={form.learningObjectives}
              aflSelections={hasAflForExport ? aflSelectionsPayload : undefined}
              teacherName={
                typeof user?.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name.trim()
                  : user?.email?.split("@")[0]
              }
            />
          </div>
        )}
        </section>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-[#00C6A7]/30 bg-[#00C6A7]/5 px-4 py-3 text-sm text-[#00C6A7]">
          {successMessage}
        </div>
      ) : null}

      {loading ? <LessonPlanLoadingGame active statusText={generationProgress} /> : null}
    </div>
  );
}
