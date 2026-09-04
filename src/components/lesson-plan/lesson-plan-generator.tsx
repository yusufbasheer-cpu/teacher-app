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
import { Sparkles, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  DEFAULT_PRESENTATION_LANGUAGE,
  PRESENTATION_LANGUAGES,
  PRESENTATION_LANGUAGE_LABELS,
  defaultLanguageForSubject,
  isPresentationLanguage,
} from "@/lib/ppt-language";
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
  CURRICULUM_TYPE_GROUPS,
  CURRICULUM_TYPE_OPTIONS,
  GENERATION_CHECKBOX_LABELS,
  GRADE_YEAR_OPTIONS,
  LANGUAGE_SUBJECT_OPTIONS,
  STEM_SUBJECT_OPTIONS,
  SUBJECT_OPTIONS,
  TEACHER_PACKAGE_SECTIONS,
  TEACHING_STRATEGIES,
  buildDifferentiatedPackSourceText,
  buildGenerationSourceMaterial,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
  mergePptSlideImageUrlsIntoPlan,
  mergeSectionImagesMeta,
  parseSectionImagesMeta,
  resolveGenerationTopic,
  resolveLessonTitle,
} from "@/lib/lesson-plan";
import { writeDiffPackSession } from "@/lib/differentiated-pack-session";
import { CURRICULUM_FRAMEWORK_OPTIONS, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  type TemplateId as PptThemeId,
} from "@/lib/ppt-template-config";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { Button } from "@/components/ui/button";
import { CheckField, ChoiceCard, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import {
  Disclosure,
  EmptyState,
  Notice,
  PageTitle,
  Panel,
  PanelHeader,
  RuleItem,
  RuleRail,
  Skeleton,
} from "@/components/ui/panel";
import { GenerationLimitModal } from "@/components/usage/generation-limit-modal";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { GENERATION_LIMIT_ERROR_CODE, type UserUsageSnapshot } from "@/lib/user-usage";
import { supabase } from "@/lib/supabase";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import { sanitizeUserMessage, toUserFacingError, USER_FACING_ERROR, GENERATION_FAILED_ERROR } from "@/lib/user-facing-errors";
import { useErrorToast } from "@/hooks/use-error-toast";
import { AFL_PHASE_IDS, type AflPhaseId } from "@/lib/afl-tools";
import { AflSelector } from "@/components/lesson-plan/afl-selector";
import { PaymentModal } from "@/components/payment/payment-modal";
import { PLANS } from "@/lib/plans";
import { LockedFeaturePanel } from "@/components/premium/locked-feature-panel";
import { LockedPreviewPill } from "@/components/premium/locked-preview-pill";
import { ProBadge } from "@/components/premium/pro-badge";

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
  console.error("[lesson-plan upload] extract failed", {
    status,
    error: data.error,
    partialErrors: data.partialErrors,
    rawLength: raw.length,
  });
  return USER_FACING_ERROR;
}

const initialForm: LessonPlanInput = {
  curriculumType: "CBSE/NCERT",
  curriculumFramework: "",
  grade: "Grade 1",
  subject: "Math",
  chapter: "",
  topic: "",
  learningObjectives: "",
  language: DEFAULT_PRESENTATION_LANGUAGE,
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

/* Native file inputs can't be restyled wholesale, so the button half is
   styled to match the Button primitive and the rest kept quiet. */
const FILE_INPUT_CLASS =
  "block w-full text-[12px] text-muted file:mr-2.5 file:h-7 file:cursor-pointer file:rounded-md " +
  "file:border file:border-line file:bg-surface file:px-2.5 file:text-[12px] file:font-medium " +
  "file:text-ink hover:file:bg-hover disabled:opacity-60";

export function LessonPlanGenerator() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const {
    usage,
    loading: usageLoading,
    refresh: refreshUsage,
    applyUsage,
    headline: limitHeadline,
    subline: limitSubline,
  } = useUserUsage(Boolean(user));
  const [form, setForm] = useState<LessonPlanInput>(initialForm);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResult | null>(null);
  const [sectionImages, setSectionImages] = useState<SectionImageMap | null>(null);
  /** Pre-built PPT slide images (13 URLs); generated with lesson when PPT section is selected. */
  const [pptSlideImageUrls, setPptSlideImageUrls] = useState<(string | null)[] | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useErrorToast();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resultsRef = useRef<HTMLElement | null>(null);
  const wizardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [sectionSelection, setSectionSelection] =
    useState<Record<TeacherPackageSectionKey, boolean>>(initialSectionSelection);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadedChunks, setUploadedChunks] = useState<SourceUploadChunk[]>([]);
  const [pastedContent, setPastedContent] = useState("");
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadExtractionError, setUploadExtractionError] = useErrorToast();

  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [pptThemeId, setPptThemeId] = useState<PptThemeId>(DEFAULT_PPT_THEME_ID);
  const [teachingStrategy, setTeachingStrategy] = useState<string>("");
  /** Once the teacher picks a language, changing the subject must not silently re-default it. */
  const [languageTouched, setLanguageTouched] = useState(false);
  const [aflSelected, setAflSelected] = useState<Record<AflPhaseId, string[]>>(() => emptyAflSelected());
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  /** Fail-closed to Free's entitlements while usage is still loading, so
   * nothing flashes unlocked before the real plan is known. */
  const entitlements = usage ? PLANS[usage.planType] : PLANS.free;

  useEffect(() => {
    if (!usage) return;
    const allowed = PLANS[usage.planType].allowedSections;
    setSectionSelection((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of TEACHER_PACKAGE_SECTIONS) {
        if (!allowed.includes(key) && next[key]) {
          next[key] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [usage]);

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
    const { planTextOnly, sectionImages: loadedImages, pptSlideImageUrls: loadedPpt } =
      parseSectionImagesMeta(plan.lesson_plan);
    setLessonPlan(planTextOnly);
    setSectionImages(Object.keys(loadedImages).length > 0 ? loadedImages : null);
    setPptSlideImageUrls(
      loadedPpt && loadedPpt.length >= STRUCTURED_LESSON_DECK_SLIDE_COUNT ? loadedPpt : null,
    );
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
            setError(toUserFacingError(err, "lesson-plan-load"));
          }
        } else {
          // Pre-fill from URL params — used by the "Regenerate" action on a
          // saved lesson and by the dashboard's start-a-lesson composer, which
          // hands over the class context so the teacher doesn't re-pick it.
          const subjectParam = searchParams.get("subject");
          const gradeParam = searchParams.get("grade");
          const topicParam = searchParams.get("topic");
          const chapterParam = searchParams.get("chapter");
          const objectivesParam = searchParams.get("learningObjectives");
          const curriculumParam = searchParams.get("curriculumType");
          if (
            subjectParam ||
            gradeParam ||
            topicParam ||
            chapterParam ||
            objectivesParam ||
            curriculumParam
          ) {
            setForm((prev) => ({
              ...prev,
              ...(subjectParam && isValidSubjectOption(subjectParam) ? { subject: subjectParam } : {}),
              ...(gradeParam && isValidGradeYear(gradeParam) ? { grade: gradeParam } : {}),
              ...(topicParam ? { topic: topicParam } : {}),
              ...(chapterParam ? { chapter: chapterParam } : {}),
              ...(objectivesParam ? { learningObjectives: objectivesParam } : {}),
              ...(curriculumParam && isValidCurriculumType(curriculumParam) ? { curriculumType: curriculumParam } : {}),
            }));
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
        setPptSlideImageUrls(null);
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
        headers: await getAuthOnlyHeaders(),
        body: fd,
      });

      const raw = await res.text();
      console.log("[lesson-plan upload] response", {
        ok: res.ok,
        status: res.status,
        rawLength: raw.length,
      });

      let data: ExtractPayload;
      try {
        data = JSON.parse(raw) as ExtractPayload;
      } catch (parseErr) {
        console.error("[lesson-plan upload] JSON parse failed", parseErr, {
          status: res.status,
          rawLength: raw.length,
        });
        setUploadExtractionError(USER_FACING_ERROR);
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
        console.error("[lesson-plan upload] empty parts", { status: res.status });
        setUploadExtractionError(USER_FACING_ERROR);
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
        console.warn("[lesson-plan upload] partialErrors", data.partialErrors);
        setUploadWarnings(
          data.partialErrors.map((pe) => `${pe.sourceLabel}: could not be read. Please try another file.`),
        );
      }
    } catch (err) {
      console.error("[lesson-plan upload] thrown error", err);
      setUploadExtractionError(toUserFacingError(err, "lesson-plan-upload"));
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
    setPptSlideImageUrls(null);
    setActivePlanId(null);

    const sections = TEACHER_PACKAGE_SECTIONS.filter((k) => sectionSelection[k]);
    if (sections.length === 0) {
      setError("Select at least one item to generate.");
      return;
    }

    if (usageLoading) {
      setError("Loading your generation allowance…");
      return;
    }

    if (usage && !usage.canGenerate) {
      setLimitModalOpen(true);
      return;
    }

    // State updates before any await so the loading screen renders with them
    setLoading(true);
    setGenerationProgress("Initializing...");

    try {
      const combinedSource = combineSourceChunks(uploadedChunks);
      const pasted = pastedContent.trim();
      const pptSelected = sectionSelection["PPT Slide Content"];

      setGenerationProgress("Preparing AI request...");
      const response = await fetch("/api/lesson-plan", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          ...form,
          sections,
          ...(hasAflForExport ? { aflSelections: aflSelectionsPayload } : {}),
          ...(combinedSource.length > 0 ? { sourceMaterial: combinedSource } : {}),
          ...(pasted.length > 0 ? { pastedContent: pasted } : {}),
          ...(pptSelected ? { streamProgress: true } : {}),
          ...(teachingStrategy.trim() ? { teachingStrategy: teachingStrategy.trim() } : {}),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      setGenerationProgress("Generating lesson plan...");

      type LessonPlanApiResponse = {
        error?: string;
        lessonPlan?: LessonPlanResult;
        parseNotice?: string;
        sectionImages?: SectionImageMap;
        pptSlideImageUrls?: (string | null)[];
        rawResponse?: string;
        usage?: UserUsageSnapshot;
      };

      const syncUsageAfterGeneration = async (nextUsage?: UserUsageSnapshot) => {
        if (nextUsage) applyUsage(nextUsage);
        await refreshUsage();
      };

      const applySuccessPayload = async (data: LessonPlanApiResponse) => {
        if (!data.lessonPlan) {
          if (data.error || data.rawResponse) {
            console.error("[lesson-plan client] missing lessonPlan in payload", {
              error: data.error,
              rawLength: data.rawResponse?.length ?? 0,
            });
          }
          throw new Error(USER_FACING_ERROR);
        }
        const stripped = parseSectionImagesMeta(data.lessonPlan);
        setLessonPlan(stripped.planTextOnly);

        const sec =
          data.sectionImages && Object.keys(data.sectionImages).length > 0
            ? data.sectionImages
            : stripped.sectionImages;
        setSectionImages(Object.keys(sec).length > 0 ? sec : null);

        const noticeRaw =
          typeof data.parseNotice === "string" && data.parseNotice.trim()
            ? data.parseNotice.trim()
            : "";
        const safeNotices = filterUserFacingNotices(
          noticeRaw ? noticeRaw.split(/\n\n+/).map((p) => p.trim()) : [],
        );
        setParseNotice(safeNotices.length > 0 ? safeNotices.join("\n\n") : null);


        const fromApi = data.pptSlideImageUrls;
        const ppt =
          Array.isArray(fromApi) && fromApi.length >= STRUCTURED_LESSON_DECK_SLIDE_COUNT
            ? fromApi.slice(0, STRUCTURED_LESSON_DECK_SLIDE_COUNT)
            : stripped.pptSlideImageUrls &&
                stripped.pptSlideImageUrls.length >= STRUCTURED_LESSON_DECK_SLIDE_COUNT
              ? stripped.pptSlideImageUrls
              : null;
        setPptSlideImageUrls(ppt);
        await syncUsageAfterGeneration(data.usage);

        // ── Auto-save to saved_lessons ──────────────────────────────────────
        console.log("Generation complete - attempting to save lesson plan");
        const saveLessonPlan = async () => {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) {
            console.warn("[auto-save] Skipped — no authenticated user");
            return;
          }
          const basePayload = {
            user_id: currentUser.id,
            subject: form.subject,
            grade: form.grade,
            topic: form.topic.trim(),
            curriculum: form.curriculumType,
            learning_objectives: form.learningObjectives,
            lesson_content: JSON.stringify(stripped.planTextOnly),
            ppt_content: stripped.planTextOnly["PPT Slide Content"] ?? "",
            created_at: new Date().toISOString(),
          };

          let { error: saveError } = await supabase
            .from("saved_lessons")
            .insert({ ...basePayload, chapter: form.chapter.trim() });

          // saved_lessons.chapter is a newly added column (migration
          // 20260825140000) — until it's run on the live DB, fall back to
          // saving without it rather than losing the auto-save entirely.
          if (saveError && /column .*chapter.* does not exist|could not find.*chapter/i.test(saveError.message)) {
            console.warn("[auto-save] 'chapter' column not found yet — saving without it. Run migration 20260825140000_saved_lessons_chapter.sql.");
            ({ error: saveError } = await supabase.from("saved_lessons").insert(basePayload));
          }

          if (saveError) {
            console.error("Save failed:", saveError.message, saveError);
          } else {
            console.log("Lesson saved successfully");
            setSuccessMessage("Lesson plan saved to My Lessons");
            setTimeout(() => setSuccessMessage(null), 4000);
          }
        };
        void saveLessonPlan();
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
          console.error("[lesson-plan client] stream ended without complete lesson package");
          throw new Error(USER_FACING_ERROR);
        }
        setGenerationProgress("Finalizing...");
        await applySuccessPayload(completePayload);
        // Hold the loading screen open so the celebration animation plays
        await new Promise<void>((r) => setTimeout(r, 3000));
      } else {
        const raw = await response.text();
        console.log("[lesson-plan client] /api/lesson-plan", {
          status: response.status,
          bodyLength: raw.length,
        });

        const parsed = tryParseApiJson<LessonPlanApiResponse>(
          raw,
          response.status,
          "lesson-plan-generate",
        );
        if (!parsed.ok) {
          if (parsed.rawPreview) {
            console.error("[lesson-plan client] non-JSON or parse error preview length:", parsed.rawPreview.length);
          }
          throw new Error(parsed.message);
        }
        const data = parsed.data;

        if (!response.ok) {
          if (
            response.status === 403 &&
            (data as { code?: string }).code === GENERATION_LIMIT_ERROR_CODE
          ) {
            setLimitModalOpen(true);
            return;
          }
          if (data.rawResponse) {
            console.error("[lesson-plan client] server rawResponse length:", data.rawResponse.length);
          }
          throw new Error(sanitizeUserMessage(data.error, "lesson-plan-generate"));
        }

        setGenerationProgress("Finalizing...");
        await applySuccessPayload(data);
        // Hold the loading screen open so the celebration animation plays
        await new Promise<void>((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      const msg = toUserFacingError(err, "lesson-plan-generate");
      // For generation failures always show the friendly contact-email message —
      // the technical detail has already been logged by toUserFacingError above.
      const isGenericOrTechnical =
        msg === USER_FACING_ERROR ||
        msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("fetch failed") ||
        msg.toLowerCase().includes("typeerror") ||
        msg.toLowerCase().includes("networkerror");
      setError(isGenericOrTechnical ? GENERATION_FAILED_ERROR : msg);
      setParseNotice(null);
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

  // Scroll to results when generation finishes
  useEffect(() => {
    if (!loading && lessonPlan) {
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
        topic: form.topic.trim(),
        learning_objectives: form.learningObjectives,
        lesson_plan: mergePptSlideImageUrlsIntoPlan(
          mergeSectionImagesMeta(lessonPlan, sectionImages),
          pptSlideImageUrls,
        ),
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
      setError(toUserFacingError(err, "lesson-plan-save"));
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
      topic: resolveLessonTitle(form.topic, form.chapter, form.subject),
      subject: form.subject.trim(),
      grade: form.grade.trim(),
      learningObjectives: form.learningObjectives.trim(),
      curriculumType: form.curriculumType.trim() || undefined,
      curriculumFramework: form.curriculumFramework.trim() || undefined,
      lessonSourceText,
    });
    router.push("/differentiated-worksheets");
  };

  // Skeleton in the composer's own shape, so nothing jumps when it resolves.
  if (checkingAuth) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
        <Skeleton className="h-6 w-40" />
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[420px] rounded-lg" />
          <Skeleton className="h-[280px] rounded-lg" />
        </div>
      </div>
    );
  }

  // Signed-out gate. Previously a small card marooned in the top-left of an
  // otherwise empty page, under a marketing hero that repeated the pitch to
  // someone already trying to use the tool.
  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[440px] px-4 py-16">
        <Panel>
          <EmptyState
            icon={Sparkles}
            title="Sign in to generate lessons"
            description="Your lessons, slides and worksheets are saved to your account so you can come back to them."
            action={
              <Button size="lg" render={<Link href="/login" />}>
                Sign in
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" size="lg" render={<Link href="/signup" />}>
                Create an account
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const selectedGenerationCount = Object.values(sectionSelection).filter(Boolean).length;

  const classComplete = Boolean(
    (form.chapter.trim() || form.topic.trim()) && form.learningObjectives.trim(),
  );
  const hasSource = uploadedChunks.length > 0 || pastedContent.trim().length > 0;
  const aflCount = Object.values(aflSelected).reduce((n, list) => n + list.length, 0);
  const hasApproach = aflCount > 0 || Boolean(teachingStrategy);

  return (
    <div className="w-full" ref={wizardRef}>
      {!lessonPlan ? (
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
          <PageTitle
            title="New lesson"
            description="One generation produces the whole package — plan, slides, worksheet, homework, assessment and teacher notes."
          />

          {/* Single screen, not a three-step wizard. The old flow made a
              teacher click through three screens for what is six required
              fields, and buried Generate — the product's primary action — on
              the last of them. Here the inputs sit on the left, the output
              spec and the Generate button stay in view on the right, and the
              two optional groups are collapsed rather than mandatory stops. */}
          <form
            ref={formRef}
            onSubmit={onSubmit}
            aria-busy={loading}
            noValidate
            className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <RuleRail className="min-w-0 space-y-5">
              {/* ── 1. Class ─────────────────────────────────────────── */}
              <RuleItem num={1} state={classComplete ? "done" : "active"}>
                <h2 className="text-[13px] font-semibold text-ink">Class</h2>
                <p className="mt-0.5 text-[12px] text-faint">Who the lesson is for.</p>

                <Panel className="mt-2.5 p-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Curriculum" className="sm:col-span-2">
                      <Select
                        value={form.curriculumType}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, curriculumType: e.target.value }))
                        }
                        required
                      >
                        {CURRICULUM_TYPE_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Grade">
                      <Select
                        value={form.grade}
                        onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                        required
                      >
                        {GRADE_YEAR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Subject">
                      <Select
                        value={form.subject}
                        onChange={(e) => {
                          const subject = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            subject,
                            ...(languageTouched
                              ? {}
                              : { language: defaultLanguageForSubject(subject) }),
                          }));
                        }}
                        required
                      >
                        <optgroup label="Subjects">
                          {CORE_SUBJECT_OPTIONS.filter(
                            (opt) => !(STEM_SUBJECT_OPTIONS as readonly string[]).includes(opt),
                          ).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Computer Science and STEM">
                          {STEM_SUBJECT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Language subjects">
                          {LANGUAGE_SUBJECT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </optgroup>
                      </Select>
                    </Field>

                    <Field
                      label="Presentation language"
                      hint="The whole presentation is written in this language."
                    >
                      <Select
                        value={form.language ?? DEFAULT_PRESENTATION_LANGUAGE}
                        onChange={(e) => {
                          const language = e.target.value;
                          setLanguageTouched(true);
                          if (isPresentationLanguage(language)) {
                            setForm((prev) => ({ ...prev, language }));
                          }
                        }}
                      >
                        {PRESENTATION_LANGUAGES.map((opt) => (
                          <option key={opt} value={opt}>
                            {PRESENTATION_LANGUAGE_LABELS[opt]}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label="Chapter"
                      hint="Becomes the lesson's title."
                      className="sm:col-span-2"
                    >
                      <TextInput
                        value={form.chapter}
                        onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))}
                        placeholder="Chapter 5 — Photosynthesis"
                      />
                    </Field>

                    <Field
                      label="Topic"
                      optional
                      hint="Narrow the lesson to one part of the chapter."
                      className="sm:col-span-2"
                    >
                      <TextInput
                        value={form.topic}
                        onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                        placeholder="Light-dependent reactions"
                      />
                    </Field>

                    <Field
                      label="Learning objectives"
                      hint="What students should be able to do by the end. One per line."
                      className="sm:col-span-2"
                    >
                      <TextArea
                        value={form.learningObjectives}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, learningObjectives: e.target.value }))
                        }
                        rows={4}
                        placeholder={"Explain how plants convert light into glucose\nIdentify the reactants and products of photosynthesis"}
                        required
                      />
                    </Field>

                    <Field
                      label="Curriculum framework"
                      optional
                      hint="Uses the selected framework to guide objectives, terminology, and structure — not a certified compliance check."
                      className="sm:col-span-2"
                    >
                      <Select
                        value={form.curriculumFramework}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, curriculumFramework: e.target.value }))
                        }
                      >
                        {CURRICULUM_FRAMEWORK_OPTIONS.map((opt) => (
                          <option key={opt.value === "" ? "none" : opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </Panel>
              </RuleItem>

              {/* ── 2. Source material ───────────────────────────────── */}
              <RuleItem num={2} state={hasSource ? "done" : "idle"}>
                <h2 className="text-[13px] font-semibold text-ink">Source material</h2>
                <p className="mt-0.5 text-[12px] text-faint">
                  Optional. Give Layah your textbook pages or notes and it generates from those
                  instead of from the topic alone.
                </p>

                {entitlements.sourceContent ? (
                  <Disclosure
                    className="mt-2.5"
                    title="Add your own content"
                    summary={
                      hasSource
                        ? [
                            uploadedChunks.length
                              ? `${uploadedChunks.length} file${uploadedChunks.length === 1 ? "" : "s"}`
                              : null,
                            pastedContent.trim() ? "pasted text" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "PDF, images or pasted text"
                    }
                    defaultOpen={hasSource}
                  >
                    <div className="space-y-3.5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Upload PDF" optional>
                          <input
                            ref={pdfInputRef}
                            type="file"
                            multiple
                            accept=".pdf,application/pdf"
                            onChange={(e) => onUploadFileChange(e, "pdf")}
                            disabled={uploadExtracting || loading}
                            className={FILE_INPUT_CLASS}
                          />
                        </Field>
                        <Field label="Upload images" optional>
                          <input
                            ref={imageInputRef}
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            onChange={(e) => onUploadFileChange(e, "image")}
                            disabled={uploadExtracting || loading}
                            className={FILE_INPUT_CLASS}
                          />
                        </Field>
                      </div>

                      <Field
                        label="Paste content"
                        optional
                        hint="Pasted text is treated as the primary source when present."
                        action={
                          pastedContent.trim().length > 0 ? (
                            <button
                              type="button"
                              onClick={clearPastedContent}
                              disabled={uploadExtracting || loading}
                              className="font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
                            >
                              Clear
                            </button>
                          ) : null
                        }
                      >
                        <TextArea
                          value={pastedContent}
                          onChange={(e) => setPastedContent(e.target.value)}
                          disabled={uploadExtracting || loading}
                          rows={6}
                          placeholder="Paste chapter text, notes or any material here."
                        />
                      </Field>

                      {uploadExtracting ? <Notice tone="brand">Reading your files…</Notice> : null}
                      {uploadExtractionError ? (
                        <Notice
                          tone="danger"
                          className="max-h-56 overflow-y-auto whitespace-pre-wrap"
                        >
                          {uploadExtractionError}
                        </Notice>
                      ) : null}
                      {uploadInfo ? <Notice tone="brand">{uploadInfo}</Notice> : null}
                      {uploadWarnings.length > 0 ? (
                        <Notice tone="generated">
                          <ul className="list-inside list-disc space-y-0.5">
                            {uploadWarnings.map((w, i) => (
                              <li key={`warn-${i}`}>{w}</li>
                            ))}
                          </ul>
                        </Notice>
                      ) : null}

                      {uploadedChunks.length > 0 ? (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-medium text-ink">
                              {uploadedChunks.length} file
                              {uploadedChunks.length === 1 ? "" : "s"} ·{" "}
                              <span className="font-mono tabular-nums text-faint">
                                {extractedMaterialPreview.length.toLocaleString()} characters
                              </span>
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={clearUploadedSource}
                              disabled={uploadExtracting || loading}
                            >
                              Remove all
                            </Button>
                          </div>
                          <ul className="divide-y divide-line-subtle overflow-hidden rounded-md border border-line-subtle">
                            {uploadedChunks.map((chunk) => (
                              <li
                                key={chunk.id}
                                className="flex items-center gap-2 bg-surface px-2.5 py-1.5"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12px] text-ink">
                                    {chunk.fileName}
                                  </span>
                                  <span className="block font-mono text-[10px] text-disabled">
                                    {chunk.kind === "pdf" ? "PDF" : "Image"} ·{" "}
                                    {chunk.text.length.toLocaleString()} chars
                                  </span>
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Remove ${chunk.fileName}`}
                                  className="hover:text-danger-text"
                                  onClick={() => removeUploadedChunk(chunk.id)}
                                  disabled={uploadExtracting || loading}
                                >
                                  <X />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {combinedSourcePreview.length > 0 ? (
                        <Field
                          label="What will be sent"
                          hint={
                            pastedContent.trim().length > 0
                              ? "Pasted content leads; uploads follow as supporting context."
                              : "Extracted text from your uploads."
                          }
                        >
                          <TextArea
                            readOnly
                            value={combinedSourcePreview}
                            rows={8}
                            spellCheck={false}
                            className="max-h-72 font-mono text-[11px] leading-relaxed"
                          />
                        </Field>
                      ) : null}
                    </div>
                  </Disclosure>
                ) : (
                  <div className="mt-2.5">
                    <LockedFeaturePanel
                      title="Source content"
                      description="Upload a PDF, images or pasted text and generate from your own material instead of the topic alone."
                      onUpgrade={() => setPaymentModalOpen(true)}
                    >
                      <div className="grid gap-2 sm:grid-cols-3">
                        <LockedPreviewPill label="Upload PDF" />
                        <LockedPreviewPill label="Upload image" />
                        <LockedPreviewPill label="Paste content" />
                      </div>
                    </LockedFeaturePanel>
                  </div>
                )}
              </RuleItem>

              {/* ── 3. Teaching approach ─────────────────────────────── */}
              <RuleItem num={3} state={hasApproach ? "done" : "idle"}>
                <h2 className="text-[13px] font-semibold text-ink">Teaching approach</h2>
                <p className="mt-0.5 text-[12px] text-faint">
                  Optional. Shapes how activities are delivered; the lesson structure stays the
                  same either way.
                </p>

                <div className="mt-2.5 space-y-2">
                  <Disclosure
                    title="Assessment for learning"
                    summary={aflCount > 0 ? `${aflCount} selected` : "Add checks for understanding"}
                    defaultOpen={aflCount > 0}
                  >
                    <AflSelector
                      selected={aflSelected}
                      onChange={(next) => setAflSelected(next as Record<AflPhaseId, string[]>)}
                      locked={!entitlements.afl}
                      onUpgrade={() => setPaymentModalOpen(true)}
                      context={{
                        subject: form.subject.trim(),
                        grade: form.grade.trim(),
                        topic: resolveGenerationTopic(form.topic, form.chapter),
                        learningObjectives: form.learningObjectives.trim(),
                      }}
                    />
                  </Disclosure>

                  {entitlements.teachingStrategy ? (
                    <Disclosure
                      title="Teaching strategy"
                      summary={
                        teachingStrategy || "Project-based, inquiry, flipped classroom and more"
                      }
                      defaultOpen={Boolean(teachingStrategy)}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TEACHING_STRATEGIES.map((strategy) => (
                          <ChoiceCard
                            key={strategy.id}
                            selected={teachingStrategy === strategy.name}
                            title={strategy.name}
                            description={strategy.description}
                            onClick={() =>
                              setTeachingStrategy(
                                teachingStrategy === strategy.name ? "" : strategy.name,
                              )
                            }
                          />
                        ))}
                      </div>
                      {teachingStrategy ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="mt-2"
                          onClick={() => setTeachingStrategy("")}
                        >
                          Clear strategy
                        </Button>
                      ) : null}
                    </Disclosure>
                  ) : (
                    <LockedFeaturePanel
                      title="Teaching strategy"
                      description="Choose a strategy — project-based, inquiry-based, flipped classroom and more — to shape how activities are delivered."
                      onUpgrade={() => setPaymentModalOpen(true)}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {TEACHING_STRATEGIES.map((strategy) => (
                          <LockedPreviewPill key={strategy.id} label={strategy.name} />
                        ))}
                      </div>
                    </LockedFeaturePanel>
                  )}
                </div>
              </RuleItem>
            </RuleRail>

            {/* ── Launch panel: what comes out, and the one button ──── */}
            <aside className="min-w-0 lg:sticky lg:top-[68px]">
              <Panel className="overflow-hidden">
                <PanelHeader
                  title="What to generate"
                  actions={
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setSectionSelection(
                            Object.fromEntries(
                              TEACHER_PACKAGE_SECTIONS.map((k) => [
                                k,
                                entitlements.allowedSections.includes(k),
                              ]),
                            ) as Record<TeacherPackageSectionKey, boolean>,
                          )
                        }
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setSectionSelection(
                            Object.fromEntries(
                              TEACHER_PACKAGE_SECTIONS.map((k) => [k, false]),
                            ) as Record<TeacherPackageSectionKey, boolean>,
                          )
                        }
                      >
                        None
                      </Button>
                    </div>
                  }
                />

                <div className="p-2">
                  {TEACHER_PACKAGE_SECTIONS.map((key) => {
                    const allowed = entitlements.allowedSections.includes(key);
                    if (!allowed) {
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPaymentModalOpen(true)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
                        >
                          <span
                            className="size-4 shrink-0 rounded-xs border border-line bg-sunken"
                            aria-hidden
                          />
                          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="truncate text-[13px] text-disabled">
                              {GENERATION_CHECKBOX_LABELS[key]}
                            </span>
                            <ProBadge />
                          </span>
                        </button>
                      );
                    }
                    return (
                      <CheckField
                        key={key}
                        id={`gen-${key}`}
                        checked={sectionSelection[key]}
                        onChange={() =>
                          setSectionSelection((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        label={GENERATION_CHECKBOX_LABELS[key]}
                      />
                    );
                  })}
                </div>

                <div className="border-t border-line-subtle p-3">
                  <Button
                    type="submit"
                    size="xl"
                    block
                    disabled={
                      loading ||
                      uploadExtracting ||
                      TEACHER_PACKAGE_SECTIONS.every((k) => !sectionSelection[k])
                    }
                  >
                    {loading ? "Generating…" : "Generate lesson"}
                  </Button>

                  <p className="mt-2 text-center text-[11px] text-faint">
                    {selectedGenerationCount === 0 ? (
                      "Pick at least one item to generate"
                    ) : (
                      <>
                        <span className="font-mono tabular-nums text-muted">
                          {selectedGenerationCount}
                        </span>{" "}
                        item{selectedGenerationCount === 1 ? "" : "s"} · uses 1 generation
                      </>
                    )}
                  </p>

                  {error ? (
                    <Notice tone="danger" className="mt-2.5 whitespace-pre-wrap break-words">
                      {error.replace("info@layah.in", "").trimEnd()}
                      {error.includes("info@layah.in") ? (
                        <>
                          {" "}
                          <a
                            href="mailto:info@layah.in"
                            className="font-medium underline underline-offset-2"
                          >
                            info@layah.in
                          </a>
                        </>
                      ) : null}
                    </Notice>
                  ) : null}
                </div>
              </Panel>
            </aside>
          </form>
        </div>
      ) : (
        <section ref={resultsRef} className="animate-rise">
          <TeacherPackageViewer
            lessonPlan={lessonPlan}
            sectionImages={sectionImages ?? undefined}
            subject={form.subject}
            grade={form.grade}
            topic={resolveLessonTitle(form.topic, form.chapter, form.subject)}
            curriculumFramework={form.curriculumFramework.trim() || undefined}
            pptThemeId={pptThemeId}
            onPptThemeChange={setPptThemeId}
            learningObjectives={form.learningObjectives}
            chapter={form.chapter}
            language={form.language ?? DEFAULT_PRESENTATION_LANGUAGE}
            aflSelections={hasAflForExport ? aflSelectionsPayload : undefined}
            pptSlideImageUrls={pptSlideImageUrls ?? undefined}
            teacherName={
              typeof user?.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name.trim()
                : user?.email?.split("@")[0]
            }
            parseNotice={parseNotice}
            onRegenerate={() => {
              // Back to the composer with every input still in place, so
              // "regenerate" means adjust-and-rerun rather than start over.
              setLessonPlan(null);
            }}
            onSave={onSaveLessonPlan}
            saving={saving}
            onSendToDifferentiatedPack={onSendToDifferentiatedPack}
          />
        </section>
      )}

      {successMessage ? (
        <div className="animate-slide-up rounded-xl border border-[color-mix(in_oklch,var(--brand)_30%,transparent)] bg-[color-mix(in_oklch,var(--brand)_5%,transparent)] px-4 py-3 text-sm text-[var(--brand)]">
          {successMessage}
        </div>
      ) : null}

      {loading ? <LessonPlanLoadingGame active statusText={generationProgress} selectedSections={sectionSelection} /> : null}

      <GenerationLimitModal
        open={limitModalOpen}
        usage={usage}
        headline={limitHeadline}
        subline={limitSubline}
        onClose={() => setLimitModalOpen(false)}
      />

      <PaymentModal
        open={paymentModalOpen}
        planKey="pro"
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
}
