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
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/ui/animate";
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
  getGenerationTimeEstimate,
  isValidCurriculumType,
  isValidGradeYear,
  isValidSubjectOption,
  mergePptSlideImageUrlsIntoPlan,
  mergeSectionImagesMeta,
  parseSectionImagesMeta,
} from "@/lib/lesson-plan";
import { writeDiffPackSession } from "@/lib/differentiated-pack-session";
import { CURRICULUM_FRAMEWORK_OPTIONS, isValidCurriculumFramework } from "@/lib/curriculum-framework";
import {
  DEFAULT_TEMPLATE_ID as DEFAULT_PPT_THEME_ID,
  TEMPLATE_CARDS as PPT_THEME_CARDS,
  type TemplateId as PptThemeId,
} from "@/lib/ppt-template-config";
import { STRUCTURED_LESSON_DECK_SLIDE_COUNT } from "@/lib/ppt-structured-lesson";
import { GenerationLimitModal } from "@/components/usage/generation-limit-modal";
import { UpgradeUsageIndicator } from "@/components/usage/upgrade-usage-indicator";
import { useUserUsage } from "@/hooks/use-user-usage";
import { getAuthHeaders } from "@/lib/auth-headers";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { GENERATION_LIMIT_ERROR_CODE, type UserUsageSnapshot } from "@/lib/user-usage";
import { supabase } from "@/lib/supabase";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import { sanitizeUserMessage, toUserFacingError, USER_FACING_ERROR } from "@/lib/user-facing-errors";
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

// ── Sidebar widget data ───────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  starter:         "Starter",
  main:            "Main Phase",
  differentiation: "Differentiation",
  plenary:         "Plenary",
  exitTicket:      "Exit Ticket",
  successCriteria: "Success Criteria",
};

const TOOL_SKILLS: Record<string, string[]> = {
  "st-think-pair-share":      ["Communication", "Collaboration", "Critical Thinking"],
  "st-kwl-chart":             ["Critical Thinking", "Problem Solving"],
  "st-brain-dump":            ["Creativity", "Critical Thinking"],
  "st-odd-one-out":           ["Critical Thinking", "Problem Solving"],
  "st-picture-prompt":        ["Creativity", "Critical Thinking", "Communication"],
  "st-true-false-challenge":  ["Critical Thinking", "Problem Solving"],
  "st-predict-reveal":        ["Critical Thinking", "Creativity"],
  "st-kahoot-quizizz-warm-up":["Digital Literacy", "Communication"],
  "st-entry-ticket":          ["Critical Thinking"],
  "mn-i-do-we-do-you-do":     ["Critical Thinking", "Collaboration"],
  "mn-jigsaw":                ["Collaboration", "Communication", "Critical Thinking"],
  "mn-learning-stations":     ["Creativity", "Problem Solving", "Collaboration"],
  "mn-gallery-walk":          ["Collaboration", "Communication", "Creativity"],
  "mn-concept-mapping":       ["Critical Thinking", "Creativity", "Problem Solving"],
  "mn-socratic-questioning":  ["Critical Thinking", "Communication"],
  "df-must-should-could":     ["Problem Solving", "Critical Thinking"],
  "df-choice-board":          ["Creativity", "Problem Solving"],
  "df-tiered-tasks":          ["Critical Thinking", "Problem Solving"],
  "df-learning-menus":        ["Creativity", "Critical Thinking"],
  "pl-3-2-1-reflection":      ["Critical Thinking", "Communication"],
  "pl-hot-seat":              ["Communication", "Critical Thinking"],
  "pl-one-word-summary":      ["Communication", "Creativity", "Critical Thinking"],
  "pl-snowball":              ["Collaboration", "Communication", "Creativity"],
  "et-one-minute-paper":      ["Communication", "Critical Thinking"],
  "et-muddiest-point":        ["Critical Thinking", "Problem Solving"],
  "et-exit-card":             ["Critical Thinking"],
  "et-emoji-scale":           ["Communication", "Digital Literacy"],
  "sc-traffic-light":         ["Critical Thinking", "Problem Solving"],
  "sc-checklist-can-do":      ["Critical Thinking", "Problem Solving"],
  "sc-two-stars-wish":        ["Communication", "Creativity", "Critical Thinking"],
  "sc-rubric-scale":          ["Critical Thinking", "Problem Solving"],
};

type SpotlightEntry = {
  id:          string;
  label:       string;
  howItWorks:  string;
  classroomUse:string;
  purpose:     string;
  phase:       string;
  phaseLabel:  string;
  skills:      string[];
};

const ALL_AFL_SPOTLIGHT: SpotlightEntry[] = AFL_PHASE_GROUPS.flatMap((g) =>
  g.tools.map((t) => ({
    id:          t.id,
    label:       t.label,
    howItWorks:  t.howItWorks,
    classroomUse:t.classroomUse,
    purpose:     t.purpose,
    phase:       g.phase,
    phaseLabel:  PHASE_LABELS[g.phase] ?? g.phase,
    skills:      TOOL_SKILLS[t.id] ?? ["Critical Thinking"],
  })),
);

const QUICK_TIPS = [
  "Be specific with your topic for better, more accurate content.",
  "Select Activity Sheet AFL tools to get classroom-ready activities in your PPT.",
  "Use the UAE Framework toggle for inspection-ready lesson plans.",
  "Upload your own content so the AI uses it as the primary source.",
  "Select only the sections you need to generate faster.",
];

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
  const [packReady, setPackReady] = useState(false);

  const resultsRef = useRef<HTMLElement | null>(null);

  // Pick a random AFL tool spotlight on mount (changes each page load)
  const spotlight = useMemo(
    () => ALL_AFL_SPOTLIGHT[Math.floor(Math.random() * ALL_AFL_SPOTLIGHT.length)]!,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
            topic: form.topic,
            curriculum: form.curriculumType,
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
      setError(toUserFacingError(err, "lesson-plan-generate"));
      setParseNotice(null);
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

  // Scroll to results and show ready banner when generation finishes
  useEffect(() => {
    if (!loading && lessonPlan) {
      setPackReady(true);
      const timer = setTimeout(() => setPackReady(false), 3500);
      setTimeout(() => {
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
        topic: form.topic,
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

  const generationEta = getGenerationTimeEstimate(sectionSelection);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="rounded-2xl border border-[#00C6A7]/20 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          Signed in as <span className="font-semibold">{user.email}</span>
        </div>
        <UpgradeUsageIndicator usage={usage} loading={usageLoading} />
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
            <label htmlFor="chapter" className="mb-1 block text-sm font-medium text-slate-700">
              Chapter name
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
              Add Activity Sheet AFL Tools to Your Lesson
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
                  Select Activity Sheet AFL Tools for Your Lesson
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

        {/* ── Teaching & Learning Strategy selector ──────────────────── */}
        {!strategyPanelOpen ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setStrategyPanelOpen(true)}
              className="w-full rounded-xl border border-[#00C6A7]/30 bg-[#00C6A7]/5 px-4 py-3 text-left text-sm font-semibold text-[#0A1628] shadow-sm transition hover:bg-[#00C6A7]/10"
            >
              {teachingStrategy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-[#00C6A7]" />
                  Teaching Strategy: <span className="font-bold text-[#00C6A7]">{TEACHING_STRATEGIES.find((s) => s.name === teachingStrategy)?.name ?? teachingStrategy}</span>
                </span>
              ) : (
                "Teaching and Learning Strategy"
              )}
              <span className="mt-1 block text-xs font-normal text-slate-600">
                Optional: select a strategy to shape how activities are delivered. The lesson structure will remain unchanged.
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#00C6A7]/30 bg-gradient-to-b from-[#00C6A7]/5 to-white p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Teaching and Learning Strategy <span className="ml-1 text-xs font-normal text-slate-500">(Optional)</span></h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a strategy to shape how activities are delivered. The lesson structure will remain unchanged.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {teachingStrategy ? (
                  <button
                    type="button"
                    onClick={() => setTeachingStrategy("")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setStrategyPanelOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
                        ? "border-[#00C6A7] bg-[#00C6A7]/8 shadow-md ring-2 ring-[#00C6A7]/20"
                        : "border-slate-200 bg-white hover:border-[#00C6A7]/50 hover:bg-[#00C6A7]/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold leading-snug ${isSelected ? "text-[#0A8F7A]" : "text-slate-900"}`}>
                        {strategy.name}
                      </span>
                      {isSelected ? (
                        <span className="shrink-0 rounded-full bg-[#00C6A7] p-0.5">
                          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 group-hover:text-slate-600">
                      {strategy.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* ── End Teaching Strategy ──────────────────────────────────── */}

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
          {generationEta.selectedCount === 0 ? (
            generationEta.detail
          ) : (
            <>
              {generationEta.tier} ({generationEta.detail}) — {generationEta.selectedCount} item
              {generationEta.selectedCount === 1 ? "" : "s"} selected
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

        {/* ── RIGHT COLUMN wrapper — keeps banner + content as one grid item ── */}
        <div className="flex min-w-0 flex-col gap-4">

          {/* Pack-ready success banner */}
          <div
            role="status"
            aria-live="polite"
            style={{
              transition: "opacity 0.4s ease, transform 0.4s ease",
              opacity: packReady ? 1 : 0,
              transform: packReady ? "translateY(0)" : "translateY(-8px)",
              pointerEvents: packReady ? "auto" : "none",
            }}
            className="flex items-center gap-3 rounded-2xl border border-[#00C6A7]/40 bg-[#00C6A7]/10 px-4 py-3 text-sm font-medium text-[#007a66] shadow-sm"
          >
            <span className="text-lg">✅</span>
            <span>Your lesson pack is ready! Scroll down to view and download.</span>
          </div>

          {!lessonPlan ? (
            <>
              {/* ── Quick Tips ──────────────────────────────────────────── */}
              <FadeIn delay={0.05}>
              <div
                className="card-hover rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                style={{ borderRadius: 12 }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[#00C6A7] text-lg">💡</span>
                  <h4 className="text-base font-semibold" style={{ color: "#0A1628" }}>
                    Tips for Best Results
                  </h4>
                </div>
                <ul className="space-y-2.5">
                  {QUICK_TIPS.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "#00C6A7" }}
                      >
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              </FadeIn>

              {/* ── AFL Tool Spotlight ──────────────────────────────────── */}
              {spotlight && (
              <FadeIn delay={0.12}>
                <div
                  className="card-hover rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  style={{ borderRadius: 12 }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <h4 className="text-base font-semibold" style={{ color: "#0A1628" }}>
                        AFL Tool Spotlight
                      </h4>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: "#0A1628" }}
                    >
                      {spotlight.phaseLabel}
                    </span>
                  </div>

                  <p className="mb-1 text-xl font-bold" style={{ color: "#00C6A7" }}>
                    {spotlight.label}
                  </p>
                  <p className="mb-3 text-sm text-slate-500">{spotlight.purpose}</p>

                  <div className="mb-3 rounded-lg p-3" style={{ background: "#F7F9FC" }}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      How to Use in Class
                    </p>
                    <p className="text-sm text-slate-700">{spotlight.howItWorks}</p>
                    <p className="mt-1 text-sm text-slate-600">{spotlight.classroomUse}</p>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      21st Century Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {spotlight.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            borderColor: "#00C6A7",
                            color: "#007a66",
                            background: "rgba(0,198,167,0.08)",
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] text-slate-400">
                    Refreshes with a new tool each time you visit this page.
                  </p>
                </div>
              </FadeIn>
              )}
            </>
          ) : (
          <section
            ref={resultsRef}
            className="animate-slide-up min-w-0 rounded-3xl border border-[#00C6A7]/20 bg-white p-5 shadow-sm sm:p-6 md:p-7"
          >
            <h3 className="text-xl font-semibold text-slate-900">Generated teacher package</h3>
            <p className="mt-2 text-sm text-slate-600">
              Preview and download only the sections you generated (lesson plan, slides, worksheet, and more).
            </p>
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
                <p className="text-sm font-semibold text-slate-900">Presentation template</p>
                <p className="mt-1 text-xs text-slate-600">
                  Pick a template for your PowerPoint, then use Download PPT. Classic is selected by default.
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
                          Template {t.themeNumber}
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
              subject={form.subject}
              grade={form.grade}
              topic={form.topic}
              curriculumFramework={form.curriculumFramework.trim() || undefined}
              pptThemeId={pptThemeId}
              learningObjectives={form.learningObjectives}
              aflSelections={hasAflForExport ? aflSelectionsPayload : undefined}
              pptSlideImageUrls={pptSlideImageUrls ?? undefined}
              teacherName={
                typeof user?.user_metadata?.full_name === "string"
                  ? user.user_metadata.full_name.trim()
                  : user?.email?.split("@")[0]
              }
            />
          </div>
          </section>
        )}
        </div>{/* end right column */}
      </div>{/* end grid */}

      {successMessage ? (
        <div className="animate-slide-up rounded-xl border border-[#00C6A7]/30 bg-[#00C6A7]/5 px-4 py-3 text-sm text-[#00C6A7]">
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
    </div>
  );
}
