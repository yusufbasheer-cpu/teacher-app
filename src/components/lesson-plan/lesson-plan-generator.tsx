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
import { AnimatePresence, motion } from "framer-motion";
import { FileText, GraduationCap, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { LessonPlanLoadingGame } from "@/components/lesson-plan/lesson-plan-loading-game";
import { TeacherPackageViewer } from "@/components/lesson-plan/teacher-package-viewer";
import { Container } from "@/components/ui/container";
import { PageLoader } from "@/components/ui/animate";
import { FORM_COLUMN_CLASS } from "@/components/layout/page-header";
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
  resolveLessonTitle,
} from "@/lib/lesson-plan";
import { writeDiffPackSession } from "@/lib/differentiated-pack-session";
import { CURRICULUM_FRAMEWORK_OPTIONS, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  type TemplateId as PptThemeId,
} from "@/lib/ppt-template-config";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { GenerationLimitModal } from "@/components/usage/generation-limit-modal";
import { StepWizardProgress } from "@/components/ui/step-wizard-progress";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { GENERATION_LIMIT_ERROR_CODE, type UserUsageSnapshot } from "@/lib/user-usage";
import { supabase } from "@/lib/supabase";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import { sanitizeUserMessage, toUserFacingError, USER_FACING_ERROR, GENERATION_FAILED_ERROR } from "@/lib/user-facing-errors";
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

const WIZARD_STEPS: { id: 1 | 2 | 3; label: string }[] = [
  { id: 1, label: "Class Details" },
  { id: 2, label: "Source Content" },
  { id: 3, label: "Generate Package" },
];

const STEP_SLIDE_VARIANTS = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};

const STEP_FIELD_GROUP_VARIANTS = {
  container: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1] as const } },
  },
};

// Step card chrome — lifts each wizard step off the page background: a white
// surface with a soft warm border, distinct from the page's own cream tone,
// so it reads as a card rather than text floating on the canvas.
const STEP_CARD_CLASS =
  "min-w-0 rounded-2xl border p-6 sm:p-8 shadow-[0px_4px_20px_rgba(36,26,18,0.06)]";
const STEP_CARD_STYLE = { background: "#FFFFFF", borderColor: "#E8DFD1" };

// One consistent vertical rhythm between major blocks within a step — was a
// mix of mt-6/space-y-5 (20–24px) scattered ad hoc; standardized to 32px.
const STEP_SECTION_GAP_CLASS = "mt-8";

// Nested "grouped content" inside a step card — e.g. "Provide your own
// teaching content", "Teaching and Learning Strategy", "What to generate".
// Deliberately NOT a second card (no border/shadow of its own): a subtle
// tint is enough to read as "grouped" without competing with the outer
// card's border for visual weight, so nesting levels stay legible instead
// of stacking near-identical card chrome three deep.
const NESTED_GROUP_CLASS = "rounded-2xl p-4 sm:p-5";
const NESTED_GROUP_STYLE = { background: "rgba(250,246,238,0.6)" };

const STEP_LEGEND_CLASS = "flex w-full items-center gap-2 pb-3 text-lg font-semibold text-stone-900";
const STEP_LEGEND_STYLE = { borderBottom: "1px solid #E8DFD1" };

function StepLegend({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  // A <legend> would be the semantically "correct" tag here, but browsers
  // give a fieldset's first-child <legend> special default positioning that
  // straddles the fieldset's top border — invisible when these step panels
  // had no border, but it broke the moment STEP_CARD_CLASS added one. Using
  // <h2> avoids that UA behavior entirely; each field's own <label> still
  // carries the real accessibility association, so nothing is lost.
  return (
    <h2 className={STEP_LEGEND_CLASS} style={STEP_LEGEND_STYLE}>
      <Icon className="size-5 shrink-0" style={{ color: "#0E9484" }} />
      {children}
    </h2>
  );
}

function StepIntro({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-3 rounded-lg px-3 py-2.5 text-sm text-stone-600"
      style={{ background: "rgba(14, 148, 132,0.06)" }}
    >
      {children}
    </p>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resultsRef = useRef<HTMLElement | null>(null);
  const wizardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

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
  const [teachingStrategy, setTeachingStrategy] = useState<string>("");
  const [strategyPanelOpen, setStrategyPanelOpen] = useState(false);
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
          // Pre-fill form from Regenerate button URL params
          const subjectParam = searchParams.get("subject");
          const gradeParam = searchParams.get("grade");
          const topicParam = searchParams.get("topic");
          const objectivesParam = searchParams.get("learningObjectives");
          const curriculumParam = searchParams.get("curriculumType");
          if (subjectParam || gradeParam || topicParam || objectivesParam || curriculumParam) {
            setForm((prev) => ({
              ...prev,
              ...(subjectParam && isValidSubjectOption(subjectParam) ? { subject: subjectParam } : {}),
              ...(gradeParam && isValidGradeYear(gradeParam) ? { grade: gradeParam } : {}),
              ...(topicParam ? { topic: topicParam } : {}),
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
          const { error: saveError } = await supabase.from("saved_lessons").insert({
            user_id: currentUser.id,
            subject: form.subject,
            grade: form.grade,
            topic: resolveLessonTitle(form.topic, form.chapter, form.subject),
            curriculum: form.curriculumType,
            learning_objectives: form.learningObjectives,
            lesson_content: JSON.stringify(stripped.planTextOnly),
            ppt_content: stripped.planTextOnly["PPT Slide Content"] ?? "",
            created_at: new Date().toISOString(),
          });
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
        topic: resolveLessonTitle(form.topic, form.chapter, form.subject),
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

  if (checkingAuth) {
    return (
      <Container className="pt-6">
        <div className="max-w-md rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 shadow-sm">
          <PageLoader label="Checking your account…" />
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container className="pt-6">
        <div className="max-w-md rounded-3xl border border-[#0E9484]/20 bg-[#FAF6EF] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900">Login Required</h2>
          <p className="mt-2 text-sm text-stone-600">
            Please login to generate and save your personal lesson plans.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex rounded-xl bg-[#0E9484] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6B5F]"
          >
            Go to Login
          </Link>
        </div>
      </Container>
    );
  }

  const selectedGenerationCount = Object.values(sectionSelection).filter(Boolean).length;

  const scrollToWizard = () => {
    window.setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const goToNextStep = () => {
    if (formRef.current && !formRef.current.reportValidity()) return;
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
    scrollToWizard();
  };

  const goToPrevStep = () => {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
    scrollToWizard();
  };

  return (
    <div className="w-full space-y-6" ref={wizardRef}>
      {!lessonPlan ? (
        <Container className="space-y-10 pt-10">
          <div className={FORM_COLUMN_CLASS}>
            <StepWizardProgress steps={WIZARD_STEPS} currentStep={step} />
          </div>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            aria-busy={loading}
            noValidate
            className={FORM_COLUMN_CLASS}
          >
            <AnimatePresence mode="wait" initial={false}>
            {/* ══════════ STEP 1 — CLASS DETAILS ══════════ */}
            {step === 1 && (
            <motion.div
              key="step-1"
              variants={STEP_SLIDE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
            <div className={STEP_CARD_CLASS} style={STEP_CARD_STYLE}>
              <StepLegend icon={GraduationCap}>Class details</StepLegend>
              <StepIntro>
                Tell us who this lesson is for. This is the only step required to get started.
              </StepIntro>

        <AnimatedGroup variants={STEP_FIELD_GROUP_VARIANTS} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="curriculum" className="mb-1 block text-sm font-medium text-stone-700">
              Curriculum type
            </label>
            <select
              id="curriculum"
              value={form.curriculumType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, curriculumType: e.target.value }))
              }
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
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
            </select>
          </div>

          <div className="sm:col-span-2">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Curriculum Framework
            </p>
            <label
              htmlFor="curriculum-framework"
              className="mb-1 block text-sm font-medium text-stone-700"
            >
              Select Educational Framework (Optional)
            </label>
            <select
              id="curriculum-framework"
              value={form.curriculumFramework}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, curriculumFramework: e.target.value }))
              }
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
            >
              {CURRICULUM_FRAMEWORK_OPTIONS.map((opt) => (
                <option key={opt.value === "" ? "none" : opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-500">
              Leave as &quot;None&quot; for a standard plan. Choosing a framework aligns lesson plan,
              slides, worksheet, assessment, homework, and teacher notes with that system&apos;s
              expectations.
            </p>
          </div>

          <div className="sm:col-span-2 border-t border-[#E8DFD1]" />

          <div>
            <label htmlFor="grade-year" className="mb-1 block text-sm font-medium text-stone-700">
              Grade / year group
            </label>
            <select
              id="grade-year"
              value={form.grade}
              onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
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
            <label htmlFor="subject" className="mb-1 block text-sm font-medium text-stone-700">
              Subject
            </label>
            <select
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
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
              <optgroup label="Computer Science & STEM">
                {STEM_SUBJECT_OPTIONS.map((opt) => (
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
            <label htmlFor="chapter" className="mb-1 block text-sm font-medium text-stone-700">
              Chapter name
            </label>
            <input
              id="chapter"
              type="text"
              value={form.chapter}
              onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
              placeholder="e.g. Chapter 5 - Photosynthesis"
            />
          </div>

          <div>
            <label htmlFor="topic" className="mb-1 block text-sm font-medium text-stone-700">
              Topic <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <input
              id="topic"
              type="text"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              className="w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
              placeholder="Specific topic within the chapter (leave blank to use just the chapter name)"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="objectives"
              className="mb-1 block text-sm font-medium text-stone-700"
            >
              Learning objectives
            </label>
            <textarea
              id="objectives"
              value={form.learningObjectives}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, learningObjectives: e.target.value }))
              }
              className="min-h-28 w-full rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2"
              placeholder="List key outcomes students should achieve."
              required
            />
          </div>
        </AnimatedGroup>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0E9484] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B6B5F]"
                >
                  Continue
                </button>
              </div>
            </div>
            </motion.div>
            )}

            {/* ══════════ STEP 2 — SOURCE CONTENT (OPTIONAL) ══════════ */}
            {step === 2 && (
            <motion.div
              key="step-2"
              variants={STEP_SLIDE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
            <div className={STEP_CARD_CLASS} style={STEP_CARD_STYLE}>
              <StepLegend icon={FileText}>Source content</StepLegend>
              <StepIntro>
                Add textbook pages, notes, or chapter content to generate a more accurate lesson plan.
                This step is entirely optional — skip it and Layah will generate content from the topic
                and objectives alone.
              </StepIntro>

        {entitlements.sourceContent ? (
        <div className={cn(STEP_SECTION_GAP_CLASS, NESTED_GROUP_CLASS, "space-y-5")} style={NESTED_GROUP_STYLE}>
          <div>
            <p className="text-sm font-semibold text-[#241A12]">
              Provide your own teaching content (optional)
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Use any combination of PDF upload, image upload, or pasted text. Pasted content is
              treated as the <strong>primary</strong> source when present.
            </p>
          </div>

          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
              Option 1 — Upload PDF
            </p>
            <input
              ref={pdfInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={(e) => onUploadFileChange(e, "pdf")}
              disabled={uploadExtracting || loading}
              className="mt-2 block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border file:border-[#E8DFD1] file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#241A12] hover:file:bg-stone-50 disabled:opacity-60"
            />
          </div>

          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
              Option 2 — Upload Image
            </p>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={(e) => onUploadFileChange(e, "image")}
              disabled={uploadExtracting || loading}
              className="mt-2 block w-full text-sm text-stone-700 file:mr-3 file:rounded-lg file:border file:border-[#E8DFD1] file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#241A12] hover:file:bg-stone-50 disabled:opacity-60"
            />
          </div>

          <div className="rounded-xl bg-white/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-600">
                Option 3 — Paste Your Content
              </p>
              {pastedContent.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={clearPastedContent}
                  disabled={uploadExtracting || loading}
                  className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
                >
                  Clear pasted content
                </button>
              ) : null}
            </div>
            <label htmlFor="pasted-content" className="mt-2 block text-sm font-medium text-stone-800">
              Paste Your Own Content Here (Optional)
            </label>
            <textarea
              id="pasted-content"
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              disabled={uploadExtracting || loading}
              rows={8}
              placeholder="Paste your textbook content, notes, chapter text, or any material here and the AI will generate all resources based on your content."
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none ring-[#0E9484] transition-colors duration-200 focus:border-[#0E9484] focus:ring-2 disabled:opacity-60"
            />
          </div>

          {uploadedChunks.length > 0 ? (
            <button
              type="button"
              onClick={clearUploadedSource}
              disabled={uploadExtracting || loading}
              className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
            >
              Clear all uploads
            </button>
          ) : null}
          {uploadExtracting ? (
            <p className="mt-2 text-xs font-medium text-[#241A12]">
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
            <ul className="mt-3 divide-y divide-[#0E9484]/20 rounded-lg border border-[#0E9484]/20 bg-[#FAF6EF]/90">
              {uploadedChunks.map((chunk) => (
                <li
                  key={chunk.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-900">{chunk.fileName}</p>
                    <p className="text-xs text-stone-500">
                      {chunk.kind === "pdf" ? "PDF" : "Image"} ·{" "}
                      {chunk.text.length.toLocaleString()} characters
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedChunk(chunk.id)}
                    disabled={uploadExtracting || loading}
                    className="shrink-0 rounded-lg border border-red-200 bg-[#FAF6EF] px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {uploadedChunks.length > 0 ? (
            <p className="text-xs text-stone-500">
              Uploads: {extractedMaterialPreview.length.toLocaleString()} characters across{" "}
              {uploadedChunks.length} file(s).
            </p>
          ) : null}
          {combinedSourcePreview.length > 0 ? (
            <div className="mt-2">
              <label
                htmlFor="combined-source-preview"
                className="mb-1 block text-xs font-semibold text-stone-800"
              >
                Combined source preview (review before generating)
              </label>
              <textarea
                id="combined-source-preview"
                readOnly
                value={combinedSourcePreview}
                rows={12}
                spellCheck={false}
                className="max-h-80 w-full resize-y rounded-xl border border-[#E8DFD1] bg-[#FAF6EF] px-3 py-2.5 font-mono text-xs leading-relaxed text-stone-800 outline-none ring-[#0E9484] focus:ring-2"
              />
              <p className="mt-1 text-xs text-stone-500">
                {pastedContent.trim().length > 0
                  ? "Pasted content is sent as the primary source; uploads are included as supplementary context."
                  : "Uploaded extract text sent to the AI when you click Generate."}
              </p>
            </div>
          ) : null}
        </div>
        ) : (
          <div className="mt-6">
            <LockedFeaturePanel
              title="Source content"
              description="Upload your own teaching material — a PDF, images, or pasted text — and let generation use it as the primary source instead of just the topic and objectives."
              onUpgrade={() => setPaymentModalOpen(true)}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <LockedPreviewPill label="Upload PDF" />
                <LockedPreviewPill label="Upload Image" />
                <LockedPreviewPill label="Paste content" />
              </div>
            </LockedFeaturePanel>
          </div>
        )}

              <div className={cn(STEP_SECTION_GAP_CLASS, "flex justify-between")}>
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-6 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                  style={{ borderColor: "#E8DFD1" }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0E9484] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B6B5F]"
                >
                  Continue
                </button>
              </div>
            </div>
            </motion.div>
            )}

            {/* ══════════ STEP 3 — GENERATE PACKAGE ══════════ */}
            {step === 3 && (
            <motion.div
              key="step-3"
              variants={STEP_SLIDE_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
            <div className={STEP_CARD_CLASS} style={STEP_CARD_STYLE}>
              <StepLegend icon={Sparkles}>Generate package</StepLegend>
              <StepIntro>Choose what to include, then generate your teacher package.</StepIntro>

        <div className={STEP_SECTION_GAP_CLASS}>
          <AflSelector
            selected={aflSelected}
            onChange={(next) => setAflSelected(next as Record<AflPhaseId, string[]>)}
            locked={!entitlements.afl}
            onUpgrade={() => setPaymentModalOpen(true)}
          />
        </div>

        {/* ── Teaching & Learning Strategy selector ──────────────────── */}
        {!entitlements.teachingStrategy ? (
          <div className={STEP_SECTION_GAP_CLASS}>
            <LockedFeaturePanel
              title="Teaching & Learning Strategy"
              description="Choose a strategy — Project-Based, Inquiry-Based, Flipped Classroom, and more — to shape how activities are delivered. The lesson structure stays the same either way."
              onUpgrade={() => setPaymentModalOpen(true)}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {TEACHING_STRATEGIES.map((strategy) => (
                  <LockedPreviewPill key={strategy.id} label={strategy.name} />
                ))}
              </div>
            </LockedFeaturePanel>
          </div>
        ) : !strategyPanelOpen ? (
          <div className={STEP_SECTION_GAP_CLASS}>
            <button
              type="button"
              onClick={() => setStrategyPanelOpen(true)}
              className="w-full rounded-xl border border-[#0E9484]/30 bg-[#0E9484]/5 px-4 py-3 text-left text-sm font-semibold text-[#241A12] shadow-sm transition hover:bg-[#0E9484]/10"
            >
              {teachingStrategy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-[#0E9484]" />
                  Teaching Strategy: <span className="font-bold text-[#0E9484]">{TEACHING_STRATEGIES.find((s) => s.name === teachingStrategy)?.name ?? teachingStrategy}</span>
                </span>
              ) : (
                "Teaching and Learning Strategy"
              )}
              <span className="mt-1 block text-xs font-normal text-stone-600">
                Optional: select a strategy to shape how activities are delivered. The lesson structure will remain unchanged.
              </span>
            </button>
          </div>
        ) : (
          <div className={cn(STEP_SECTION_GAP_CLASS, NESTED_GROUP_CLASS, "md:p-5")} style={NESTED_GROUP_STYLE}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Teaching and Learning Strategy <span className="ml-1 text-xs font-normal text-stone-500">(Optional)</span></h3>
                <p className="mt-1 text-xs text-stone-500">
                  Select a strategy to shape how activities are delivered. The lesson structure will remain unchanged.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {teachingStrategy ? (
                  <button
                    type="button"
                    onClick={() => setTeachingStrategy("")}
                    className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStrategyPanelOpen(false)}
                  className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Collapse ↑
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {TEACHING_STRATEGIES.map((strategy) => {
                const isSelected = teachingStrategy === strategy.name;
                return (
                  <button
                    key={strategy.id}
                    type="button"
                    onClick={() => setTeachingStrategy(isSelected ? "" : strategy.name)}
                    aria-pressed={isSelected}
                    className={`group flex flex-col rounded-xl border-2 p-3.5 text-left transition ${
                      isSelected
                        ? "border-[#0E9484] bg-[#0E9484]/8 shadow-md ring-2 ring-[#0E9484]/20"
                        : "border-[#E8DFD1] bg-white hover:border-[#0E9484]/50 hover:bg-[#0E9484]/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold leading-snug ${isSelected ? "text-[#0B6B5F]" : "text-stone-900"}`}>
                        {strategy.name}
                      </span>
                      {isSelected ? (
                        <span className="shrink-0 rounded-full bg-[#0E9484] p-0.5">
                          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500 group-hover:text-stone-600">
                      {strategy.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* ── End Teaching Strategy ──────────────────────────────────── */}

        <div className={cn(STEP_SECTION_GAP_CLASS, NESTED_GROUP_CLASS)} style={NESTED_GROUP_STYLE}>
          <h3 className="text-sm font-semibold text-stone-900">What to generate</h3>
          <p className="mt-1 text-xs text-stone-600">
            Only checked sections are sent to the AI — fewer selections usually means a quicker response.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSectionSelection(
                  Object.fromEntries(
                    TEACHER_PACKAGE_SECTIONS.map((k) => [k, entitlements.allowedSections.includes(k)]),
                  ) as Record<TeacherPackageSectionKey, boolean>,
                )
              }
              className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
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
              className="rounded-lg border border-[#E8DFD1] bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
            >
              Deselect All
            </button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {TEACHER_PACKAGE_SECTIONS.map((key) => {
              const allowed = entitlements.allowedSections.includes(key);
              if (!allowed) {
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setPaymentModalOpen(true)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-[#0E9484]/5"
                    >
                      <Checkbox checked={false} disabled className="mt-0.5" />
                      <span className="flex items-center gap-2 text-sm text-stone-500">
                        {GENERATION_CHECKBOX_LABELS[key]}
                        <ProBadge />
                      </span>
                    </button>
                  </li>
                );
              }
              return (
                <li key={key} className="flex items-start gap-3">
                  <Checkbox
                    id={`gen-${key}`}
                    checked={sectionSelection[key]}
                    onChange={() =>
                      setSectionSelection((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className="mt-0.5"
                  />
                  <label htmlFor={`gen-${key}`} className="text-sm text-stone-800">
                    {GENERATION_CHECKBOX_LABELS[key]}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <p className={cn(STEP_SECTION_GAP_CLASS, "rounded-xl border px-3 py-2 text-sm text-stone-700")} style={{ borderColor: "#E8DFD1", background: "rgba(250,246,238,0.6)" }}>
          {selectedGenerationCount === 0 ? (
            <span className="font-semibold text-stone-900">Select at least one item to generate</span>
          ) : (
            <>
              <span className="font-semibold text-stone-900">{selectedGenerationCount}</span> item
              {selectedGenerationCount === 1 ? "" : "s"} selected for generation
            </>
          )}
        </p>

        <div className={cn(STEP_SECTION_GAP_CLASS, "flex justify-between")}>
          <button
            type="button"
            onClick={goToPrevStep}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-6 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
            style={{ borderColor: "#E8DFD1" }}
          >
            Back
          </button>
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            uploadExtracting ||
            TEACHER_PACKAGE_SECTIONS.every((k) => !sectionSelection[k])
          }
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#0E9484] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B6B5F] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Generating..." : "Generate Lesson Plan"}
        </button>

        {error ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-red-600">
            {error.replace("info@layah.in", "").trimEnd()}
            {error.includes("info@layah.in") ? (
              <>
                {" "}
                <a href="mailto:info@layah.in" className="underline hover:text-red-700">
                  info@layah.in
                </a>
              </>
            ) : null}
          </p>
        ) : null}
            </div>
            </motion.div>
            )}
            </AnimatePresence>
          </form>
        </Container>
      ) : (
        <section ref={resultsRef} className="animate-slide-up">
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
            aflSelections={hasAflForExport ? aflSelectionsPayload : undefined}
            pptSlideImageUrls={pptSlideImageUrls ?? undefined}
            teacherName={
              typeof user?.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name.trim()
                : user?.email?.split("@")[0]
            }
            parseNotice={parseNotice}
            onRegenerate={() => {
              setLessonPlan(null);
              setStep(1);
            }}
            onSave={onSaveLessonPlan}
            saving={saving}
            onSendToDifferentiatedPack={onSendToDifferentiatedPack}
          />
        </section>
      )}

      {successMessage ? (
        <div className="animate-slide-up rounded-xl border border-[#0E9484]/30 bg-[#0E9484]/5 px-4 py-3 text-sm text-[#0E9484]">
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
