"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { LessonPlanLoadingGame } from "@/components/lesson-plan/lesson-plan-loading-game";
import { GenerationLimitModal } from "@/components/usage/generation-limit-modal";
import { StepWizardProgress } from "@/components/ui/step-wizard-progress";
import { useErrorToast } from "@/hooks/use-error-toast";
import { FORM_COLUMN_CLASS } from "@/components/layout/page-header";
import { useUserUsage } from "@/hooks/use-user-usage";
import { PaymentModal } from "@/components/payment/payment-modal";
import { EmptyState, Notice, PageTitle, Panel, Skeleton } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { CheckField, Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LockedPageState } from "@/components/premium/locked-page-state";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";
import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";
import { GENERATION_LIMIT_ERROR_CODE, type UserUsageSnapshot } from "@/lib/user-usage";
import { supabase } from "@/lib/supabase";
import {
  CORE_SUBJECT_OPTIONS,
  CURRICULUM_TYPE_GROUPS,
  GRADE_YEAR_OPTIONS,
  LANGUAGE_SUBJECT_OPTIONS,
  STEM_SUBJECT_OPTIONS,
} from "@/lib/lesson-plan";
import {
  QUESTION_PAPER_DIFFICULTY_OPTIONS,
  QUESTION_PAPER_TIME_OPTIONS,
  QUESTION_TYPE_SPECS,
  countSelectedQuestions,
  emptyQuestionCounts,
  type GenerationMode,
  type QuestionCounts,
  type QuestionPaperResult,
  type QuestionTypeId,
} from "@/lib/question-paper";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import { sanitizeUserMessage, toUserFacingError, USER_FACING_ERROR } from "@/lib/user-facing-errors";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { questionPaperDownloadFileName } from "@/lib/question-paper-download-names";
import { triggerFileDownload } from "@/lib/trigger-file-download";

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

const WIZARD_STEPS = [
  { id: 1, label: "Paper Details" },
  { id: 2, label: "Source Content" },
  { id: 3, label: "Generate Package" },
] as const;

export function QuestionPaperGenerator() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const {
    usage,
    loading: usageLoading,
    refresh: refreshUsage,
    applyUsage,
    headline: limitHeadline,
    subline: limitSubline,
  } = useUserUsage(Boolean(user));

  const [curriculumType, setCurriculumType] = useState("CBSE/NCERT");
  const [grade, setGrade] = useState("Grade 8");
  const [subject, setSubject] = useState("Science");
  const [topic, setTopic] = useState("");
  const [totalMarks, setTotalMarks] = useState(50);
  const [timeAllowed, setTimeAllowed] = useState<(typeof QUESTION_PAPER_TIME_OPTIONS)[number]>("1 hour");
  const [difficulty, setDifficulty] = useState<(typeof QUESTION_PAPER_DIFFICULTY_OPTIONS)[number]>("Medium");
  const [questionCounts, setQuestionCounts] = useState<QuestionCounts>(emptyQuestionCounts);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("enhanced");
  const [enhancementPercent, setEnhancementPercent] = useState(50);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [includeMarkingScheme, setIncludeMarkingScheme] = useState(true);
  const [includeModelAnswers, setIncludeModelAnswers] = useState(true);
  const [generateBlueprint, setGenerateBlueprint] = useState(false);
  const [previewTab, setPreviewTab] = useState<"paper" | "blueprint">("paper");

  const [pastedContent, setPastedContent] = useState("");
  const [uploadedChunks, setUploadedChunks] = useState<SourceUploadChunk[]>([]);
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [paperReady, setPaperReady] = useState(false);
  const [error, setError] = useErrorToast();
  const [result, setResult] = useState<QuestionPaperResult | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const wizardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    };
    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const extractedMaterial = useMemo(() => combineSourceChunks(uploadedChunks), [uploadedChunks]);

  const qpLoadingSections = useMemo(
    () => ({
      "qp-paper": true,
      "qp-blueprint": generateBlueprint,
      "qp-downloads": true,
    }),
    [generateBlueprint],
  );

  const totalQuestions = useMemo(() => countSelectedQuestions(questionCounts), [questionCounts]);

  const previewText = useMemo(() => {
    if (!result) return "";
    if (previewTab === "blueprint" && result.blueprintText) {
      return result.blueprintText;
    }
    const parts = [result.questionPaper];
    if (result.answerKey) parts.push(`\n\n--- ANSWER KEY ---\n\n${result.answerKey}`);
    if (result.markingScheme) parts.push(`\n\n--- MARKING SCHEME ---\n\n${result.markingScheme}`);
    return parts.join("");
  }, [result, previewTab]);

  const setCount = (id: QuestionTypeId, value: number) => {
    setQuestionCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(50, Math.floor(value) || 0)),
    }));
  };

  const onUploadFileChange = async (e: ChangeEvent<HTMLInputElement>, kind: "pdf" | "image") => {
    const files = e.target.files;
    if (!files?.length) return;
    e.target.value = "";
    setUploadExtracting(true);
    setUploadInfo(null);
    setError(null);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    try {
      const res = await fetch("/api/lesson-plan/extract-upload", {
        method: "POST",
        headers: await getAuthOnlyHeaders(),
        body: fd,
      });
      const raw = await res.text();
      const parsed = tryParseApiJson<ExtractPayload>(raw, res.status, "question-paper-upload");
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      if (!res.ok) {
        console.error("[question-paper upload]", parsed.data.error);
        setError(USER_FACING_ERROR);
        return;
      }
      const parts = parsed.data.parts ?? [];
      if (parts.length === 0) {
        setUploadInfo("No text extracted from the file(s).");
        return;
      }
      setUploadedChunks((prev) => [
        ...prev,
        ...parts.map((p, i) => ({
          id: `${Date.now()}-${i}-${p.sourceLabel}`,
          fileName: p.sourceLabel,
          kind: p.kind,
          text: p.text,
        })),
      ]);
      setUploadInfo(`Added ${parts.length} file(s) to source material.`);
    } catch (err) {
      setError(toUserFacingError(err, "question-paper-upload"));
    } finally {
      setUploadExtracting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    triggerFileDownload(blob, filename);
  };

  const downloadQuestionPaper = async () => {
    if (!result?.questionPaper?.trim()) return;
    setDownloading("paper");
    try {
      const res = await fetch("/api/question-paper/export/docx", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          subject,
          grade,
          topic,
          totalMarks,
          timeAllowed,
          content: result.questionPaper,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        const parsed = tryParseApiJson<{ error?: string }>(raw, res.status);
        throw new Error(parsed.ok ? parsed.data.error ?? "Download failed" : parsed.message);
      }
      const blob = await res.blob();
      downloadBlob(blob, questionPaperDownloadFileName("paper", subject, grade));
    } catch (e) {
      setError(toUserFacingError(e, "question-paper-download"));
    } finally {
      setDownloading(null);
    }
  };

  const downloadBlueprint = async () => {
    if (!result?.blueprintText) return;
    setDownloading("blueprint");
    try {
      const res = await fetch("/api/question-paper/export/blueprint", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          subject,
          grade,
          topic,
          curriculumType,
          timeAllowed,
          totalMarks,
          blueprintText: result.blueprintText,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        const parsed = tryParseApiJson<{ error?: string }>(raw, res.status);
        throw new Error(parsed.ok ? parsed.data.error ?? "Blueprint download failed" : parsed.message);
      }
      const blob = await res.blob();
      downloadBlob(blob, questionPaperDownloadFileName("blueprint", subject, grade));
    } catch (e) {
      setError(toUserFacingError(e, "question-paper-blueprint-download"));
    } finally {
      setDownloading(null);
    }
  };

  const downloadZip = async () => {
    if (!result) return;
    setDownloading("zip");
    try {
      const res = await fetch("/api/question-paper/export/zip", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          subject,
          grade,
          topic,
          curriculumType,
          timeAllowed,
          totalMarks,
          questionPaper: result.questionPaper,
          blueprintText: result.blueprintText,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        const parsed = tryParseApiJson<{ error?: string }>(raw, res.status);
        throw new Error(parsed.ok ? parsed.data.error ?? "ZIP failed" : parsed.message);
      }
      const blob = await res.blob();
      downloadBlob(blob, questionPaperDownloadFileName("zip", subject, grade));
    } catch (e) {
      setError(toUserFacingError(e, "question-paper-zip-download"));
    } finally {
      setDownloading(null);
    }
  };

  useEffect(() => {
    if (!loading && result) {
      setPaperReady(true);
      const bannerTimer = setTimeout(() => setPaperReady(false), 3000);
      document.getElementById("download-section")?.scrollIntoView({ behavior: "smooth" });
      return () => clearTimeout(bannerTimer);
    }
  }, [loading, result]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (usageLoading) {
      setError("Loading your generation allowance…");
      return;
    }

    if (usage && !usage.canGenerate) {
      setLimitModalOpen(true);
      return;
    }

    setLoading(true);
    setResult(null);
    setPreviewTab("paper");
    setGenerationProgress("Generating question paper...");

    const formPayload = {
      curriculumType,
      grade,
      subject,
      topic,
      totalMarks,
      timeAllowed,
      difficulty,
      questionCounts,
      generationMode,
      enhancementPercent,
      includeAnswerKey,
      includeMarkingScheme,
      includeModelAnswers,
      ...(pastedContent.trim() ? { pastedContent: pastedContent.trim() } : {}),
      ...(extractedMaterial ? { sourceMaterial: extractedMaterial } : {}),
    };

    const syncUsageAfterGeneration = async (nextUsage?: UserUsageSnapshot) => {
      if (nextUsage) applyUsage(nextUsage);
      await refreshUsage();
    };

    try {
      const paperRes = await fetch("/api/question-paper", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(formPayload),
      });
      const paperRaw = await paperRes.text();
      console.log("[question-paper-call-1]", { status: paperRes.status, bodyLength: paperRaw.length });
      const paperParsed = tryParseApiJson<
        QuestionPaperResult & { error?: string; parseNotice?: string; usage?: UserUsageSnapshot }
      >(paperRaw, paperRes.status, "question-paper-generate");
      if (!paperParsed.ok) {
        throw new Error(paperParsed.message);
      }
      if (!paperRes.ok) {
        if (
          paperRes.status === 403 &&
          (paperParsed.data as { code?: string }).code === GENERATION_LIMIT_ERROR_CODE
        ) {
          setLimitModalOpen(true);
          return;
        }
        console.error("[question-paper-generate]", paperParsed.data.error);
        throw new Error(sanitizeUserMessage(paperParsed.data.error, "question-paper-generate"));
      }

      const safeParseNotices = filterUserFacingNotices(
        paperParsed.data.parseNotice?.trim() ? [paperParsed.data.parseNotice.trim()] : [],
      );
      const paperResult: QuestionPaperResult = {
        questionPaper: paperParsed.data.questionPaper ?? "",
        answerKey: paperParsed.data.answerKey,
        markingScheme: paperParsed.data.markingScheme,
        parseNotice: safeParseNotices.length ? safeParseNotices.join(" ") : undefined,
      };

      setResult(paperResult);

      if (!generateBlueprint) {
        setGenerationProgress("Preparing downloads...");
        await new Promise<void>((r) => setTimeout(r, 500));
        setGenerationProgress("Finalizing...");
        await new Promise<void>((r) => setTimeout(r, 3000));
        return;
      }

      setGenerationProgress("Generating blueprint...");

      const bpRes = await fetch("/api/question-paper/blueprint", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          subject,
          grade,
          topic,
          curriculumType,
          totalMarks,
          timeAllowed,
          difficulty,
          questionPaper: paperResult.questionPaper,
          answerKey: paperResult.answerKey,
        }),
      });
      const bpRaw = await bpRes.text();
      console.log("[question-paper-call-2-blueprint]", { status: bpRes.status, bodyLength: bpRaw.length });
      const bpParsed = tryParseApiJson<{ blueprintText?: string; error?: string; blueprintError?: string }>(
        bpRaw,
        bpRes.status,
        "question-paper-blueprint",
      );

      if (!bpParsed.ok) {
        console.error("[question-paper-blueprint] parse failed");
        setResult((prev) =>
          prev
            ? {
                ...prev,
                blueprintError: "failed",
              }
            : prev,
        );
        setGenerationProgress("Preparing downloads...");
        await new Promise<void>((r) => setTimeout(r, 500));
        setGenerationProgress("Finalizing...");
        await new Promise<void>((r) => setTimeout(r, 3000));
        return;
      }

      if (!bpRes.ok || !bpParsed.data.blueprintText) {
        console.error("[question-paper-blueprint] failed", {
          status: bpRes.status,
          error: bpParsed.data.error,
          blueprintError: bpParsed.data.blueprintError,
        });
        setResult((prev) => (prev ? { ...prev, blueprintError: "failed" } : prev));
        setGenerationProgress("Preparing downloads...");
        await new Promise<void>((r) => setTimeout(r, 500));
        setGenerationProgress("Finalizing...");
        await new Promise<void>((r) => setTimeout(r, 3000));
        return;
      }

      setResult((prev) =>
        prev
          ? {
              ...prev,
              blueprintText: bpParsed.data.blueprintText,
            }
          : prev,
      );
      setGenerationProgress("Preparing downloads...");
      await new Promise<void>((r) => setTimeout(r, 500));
      setGenerationProgress("Finalizing...");
      await new Promise<void>((r) => setTimeout(r, 3000));
    } catch (err) {
      setError(toUserFacingError(err, "question-paper-generate"));
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

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

  if (checkingAuth) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-6 h-[420px] rounded-lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[440px] px-4 py-16">
        <Panel>
          <EmptyState
            icon={Lock}
            title="Sign in to continue"
            description="Your question papers and mark schemes are saved to your account."
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

  if (usageLoading || !usage) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-6 h-[420px] rounded-lg" />
      </div>
    );
  }

  if (!PLANS[usage.planType].questionPaper) {
    return (
      <>
        <LockedPageState
          title="Question papers"
          description="Build an exam paper for any chapter, with the mark distribution you set."
          includes={[
            "A blueprint you control — sections, question types and marks per section",
            "Questions written to your curriculum and grade",
            "A full mark scheme and answer key",
            "Word and ZIP export, ready to print",
          ]}
          onUpgrade={() => setPaymentModalOpen(true)}
        />
        <PaymentModal
          open={paymentModalOpen}
          planKey="pro"
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8" ref={wizardRef}>
      {!result ? (
        <>
          <PageTitle
            title="New question paper"
            description="Set the blueprint, then generate the paper, mark scheme and answer key together."
            className="mb-5"
          />
          <div className={FORM_COLUMN_CLASS}>
            <StepWizardProgress steps={WIZARD_STEPS} currentStep={step} />
          </div>

          <form ref={formRef} onSubmit={onSubmit} noValidate className={`${FORM_COLUMN_CLASS} space-y-6`}>
        {/* ══════════ STEP 1 — PAPER DETAILS ══════════ */}
        <fieldset hidden={step !== 1} className="min-w-0">
          <legend className="block w-full border-b border-line pb-3 text-lg font-semibold text-ink">
            Basic details
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Curriculum type" className="sm:col-span-2">
              <Select value={curriculumType} onChange={(e) => setCurriculumType(e.target.value)} required>
                {CURRICULUM_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Grade">
              <Select value={grade} onChange={(e) => setGrade(e.target.value)} required>
                {GRADE_YEAR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)} required>
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
              </Select>
            </Field>
            <Field label="Topic or chapter name" className="sm:col-span-2">
              <TextInput
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis"
                required
              />
            </Field>
            <Field label="Total marks">
              <TextInput
                type="number"
                min={1}
                max={500}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Time allowed">
              <Select
                value={timeAllowed}
                onChange={(e) =>
                  setTimeAllowed(e.target.value as (typeof QUESTION_PAPER_TIME_OPTIONS)[number])
                }
              >
                {QUESTION_PAPER_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Difficulty level" className="sm:col-span-2">
              <Select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as (typeof QUESTION_PAPER_DIFFICULTY_OPTIONS)[number])
                }
              >
                {QUESTION_PAPER_DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        {step === 1 ? (
          <div className="flex justify-end">
            <Button type="button" size="lg" onClick={goToNextStep}>
              Continue
            </Button>
          </div>
        ) : null}

        {/* ══════════ STEP 2 — SOURCE CONTENT (OPTIONAL) ══════════ */}
        <fieldset hidden={step !== 2} className="min-w-0">
          <legend className="block w-full border-b border-line pb-3 text-lg font-semibold text-ink">
            Provide your content
          </legend>
          <p className="mt-3 text-xs text-muted">
            Optional — AI will generate based on topic if no content is provided (except in Strict
            mode).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => onUploadFileChange(e, "pdf")}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => onUploadFileChange(e, "image")}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadExtracting || loading}
              onClick={() => pdfInputRef.current?.click()}
            >
              Upload PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploadExtracting || loading}
              onClick={() => imageInputRef.current?.click()}
            >
              Upload image
            </Button>
          </div>
          <Field label="Paste content" optional className="mt-4">
            <TextArea
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              disabled={uploadExtracting || loading}
              rows={6}
              placeholder="Paste chapter notes, textbook extract, or teaching content…"
            />
          </Field>
          {uploadInfo ? <p className="mt-2 text-xs text-brand-text">{uploadInfo}</p> : null}
          {uploadedChunks.length > 0 ? (
            <p className="mt-2 text-xs text-muted">
              {uploadedChunks.length} file(s) attached ({extractedMaterial.length.toLocaleString()}{" "}
              chars extracted)
            </p>
          ) : null}
        </fieldset>

        {step === 2 ? (
          <div className="flex justify-between">
            <Button type="button" variant="outline" size="lg" onClick={goToPrevStep}>
              Back
            </Button>
            <Button type="button" size="lg" onClick={goToNextStep}>
              Continue
            </Button>
          </div>
        ) : null}

        {/* ══════════ STEP 3 — GENERATE PACKAGE ══════════ */}
        <fieldset hidden={step !== 3} className="space-y-6">
        <Panel className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Question types</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {QUESTION_TYPE_SPECS.map((spec) => (
              <div
                key={spec.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line-subtle bg-hover/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">{spec.label}</p>
                  <p className="text-[11px] text-faint">{spec.description}</p>
                </div>
                <TextInput
                  type="number"
                  min={0}
                  max={50}
                  value={questionCounts[spec.id]}
                  onChange={(e) => setCount(spec.id, Number(e.target.value))}
                  className="w-14 text-center"
                  aria-label={`Count for ${spec.label}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-inverse">
            <span>
              Total questions: <strong>{totalQuestions}</strong>
            </span>
            <span>
              Paper marks: <strong>{totalMarks}</strong>
            </span>
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Generation mode</h2>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-subtle">
              <input
                type="radio"
                name="genMode"
                checked={generationMode === "strict"}
                onChange={() => setGenerationMode("strict")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="font-semibold text-ink">Strictly based on my content</span>
                <span className="mt-1 block text-xs text-muted">
                  AI will generate questions using ONLY the content you provided. No additional
                  information will be added.
                </span>
              </span>
            </label>
            {generationMode === "strict" ? (
              <Notice tone="generated" className="text-xs">
                Please upload or paste your content above for best results.
              </Notice>
            ) : null}
            <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-subtle">
              <input
                type="radio"
                name="genMode"
                checked={generationMode === "enhanced"}
                onChange={() => setGenerationMode("enhanced")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="font-semibold text-ink">AI enhanced generation</span>
                <span className="mt-1 block text-xs text-muted">
                  AI may paraphrase and enhance questions beyond your provided content.
                </span>
              </span>
            </label>
            {generationMode === "enhanced" ? (
              <div className="rounded-xl border border-line bg-hover p-4">
                <div className="flex items-center justify-between text-sm font-medium text-ink">
                  <span>Enhancement level</span>
                  <span className="text-brand">{enhancementPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={enhancementPercent}
                  onChange={(e) => setEnhancementPercent(Number(e.target.value))}
                  className="mt-3 w-full accent-brand"
                />
                <p className="mt-2 text-[11px] text-muted">
                  0–20%: mostly your content · 21–50%: balanced · 51–80%: mostly AI · 81–100%: fully AI
                  from topic
                </p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">Answer key options</h2>
          <div className="mt-3 space-y-1">
            <CheckField
              label="Include answer key"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
            />
            <CheckField
              label="Include marking scheme"
              checked={includeMarkingScheme}
              onChange={(e) => setIncludeMarkingScheme(e.target.checked)}
            />
            <CheckField
              label="Include model answers for long questions"
              checked={includeModelAnswers}
              onChange={(e) => setIncludeModelAnswers(e.target.checked)}
            />
          </div>
        </Panel>

        <Panel className="border-brand-border/50 p-4 sm:p-5">
          <CheckField
            label="Generate Blueprint with Question Paper"
            description="After your paper is ready, a second pass analyzes it and builds chapter-wise, Bloom's, question-type, and difficulty tables (plain text, not JSON)."
            checked={generateBlueprint}
            onChange={(e) => setGenerateBlueprint(e.target.checked)}
          />
        </Panel>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="flex justify-between gap-3">
          <Button type="button" variant="outline" size="lg" onClick={goToPrevStep}>
            Back
          </Button>
        </div>

        <Button type="submit" size="xl" block disabled={loading || totalQuestions < 1}>
          {loading ? "Generating…" : "Generate question paper"}
        </Button>
        </fieldset>
          </form>
        </>
      ) : (
        <section className="mx-auto w-full max-w-[820px] space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-semibold text-ink">Your question paper is ready</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                setStep(1);
              }}
            >
              ← Edit details
            </Button>
          </div>

          <div
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-2xl border border-brand-border bg-brand-subtle px-4 py-3 text-sm font-semibold text-brand-text",
              "transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)]",
              paperReady ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2",
            )}
          >
            Your Question Paper is ready!
          </div>

          <div className="min-h-[420px] rounded-2xl border border-brand-border/50 bg-surface-raised">
            <div className="rounded-t-2xl bg-ink px-4 py-3 text-sm font-semibold text-inverse sm:px-5">
              Preview
            </div>
            {result?.blueprintText ? (
              <Tabs
                value={previewTab}
                onValueChange={(v) => setPreviewTab(v as "paper" | "blueprint")}
              >
                <TabsList
                  variant="line"
                  className="h-auto w-full justify-start gap-1 rounded-none border-b border-line bg-hover px-2 pt-2"
                >
                  <TabsTrigger value="paper" className="flex-none rounded-t-lg px-4 py-2 text-xs">
                    Question paper
                  </TabsTrigger>
                  <TabsTrigger value="blueprint" className="flex-none rounded-t-lg px-4 py-2 text-xs">
                    Blueprint
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}
            <div className="max-h-[min(60vh,560px)] overflow-y-auto p-4 sm:p-5">
              {result?.parseNotice ? (
                <Notice tone="generated" className="mb-3 text-xs">
                  {result.parseNotice}
                </Notice>
              ) : null}
              {result?.blueprintError ? (
                <Notice tone="generated" className="mb-3 text-xs">
                  Blueprint could not be generated. Your question paper and downloads are still
                  available.
                </Notice>
              ) : null}
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
                {previewText}
              </pre>
            </div>
          </div>

          <div id="download-section" className="rounded-2xl border border-brand-border/50 bg-surface-raised px-4 py-5 sm:px-5">
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                size="lg"
                block
                disabled={!!downloading}
                onClick={() => downloadQuestionPaper()}
              >
                {downloading === "paper" ? "Downloading…" : "Download Question Paper as Word"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                block
                disabled={!!downloading || !result?.blueprintText}
                onClick={() => downloadBlueprint()}
              >
                {downloading === "blueprint" ? "Downloading…" : "Download Blueprint as Word"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                block
                disabled={!!downloading}
                onClick={() => downloadZip()}
              >
                {downloading === "zip" ? "Downloading…" : "Download Complete Pack as ZIP"}
              </Button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <LessonPlanLoadingGame
          active={loading}
          statusText={generationProgress}
          selectedSections={qpLoadingSections}
          preset="question-paper"
        />
      ) : null}

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
