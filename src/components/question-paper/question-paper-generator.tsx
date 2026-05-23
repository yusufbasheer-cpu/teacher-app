"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LessonPlanLoadingGame } from "@/components/lesson-plan/lesson-plan-loading-game";
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
  getQuestionPaperTimeEstimate,
  type GenerationMode,
  type QuestionCounts,
  type QuestionPaperResult,
  type QuestionTypeId,
} from "@/lib/question-paper";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
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

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-[#00C6A7] focus:ring-2";

const sectionClass =
  "rounded-2xl border bg-white p-4 shadow-sm sm:p-5";

export function QuestionPaperGenerator() {
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionPaperResult | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
  const timeEstimate = useMemo(
    () => getQuestionPaperTimeEstimate(totalQuestions, generateBlueprint),
    [totalQuestions, generateBlueprint],
  );

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
      const res = await fetch("/api/lesson-plan/extract-upload", { method: "POST", body: fd });
      const raw = await res.text();
      const parsed = tryParseApiJson<ExtractPayload>(raw, res.status);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      if (!res.ok) {
        setError(parsed.data.error ?? `Upload failed (${res.status})`);
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
      setError(err instanceof Error ? err.message : "Upload failed.");
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
        headers: { "Content-Type": "application/json" },
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
      setError(e instanceof Error ? e.message : "Download failed");
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
        headers: { "Content-Type": "application/json" },
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
      setError(e instanceof Error ? e.message : "Blueprint download failed");
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
        headers: { "Content-Type": "application/json" },
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
      setError(e instanceof Error ? e.message : "ZIP download failed");
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

    try {
      const paperRes = await fetch("/api/question-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload),
      });
      const paperRaw = await paperRes.text();
      console.log("[question-paper-call-1] API response:", paperRaw);
      const paperParsed = tryParseApiJson<
        QuestionPaperResult & { error?: string; parseNotice?: string }
      >(paperRaw, paperRes.status);
      if (!paperParsed.ok) {
        throw new Error(paperParsed.message);
      }
      if (!paperRes.ok) {
        throw new Error(paperParsed.data.error ?? `Question paper failed (${paperRes.status})`);
      }

      const paperResult: QuestionPaperResult = {
        questionPaper: paperParsed.data.questionPaper ?? "",
        answerKey: paperParsed.data.answerKey,
        markingScheme: paperParsed.data.markingScheme,
        parseNotice: paperParsed.data.parseNotice,
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
        headers: { "Content-Type": "application/json" },
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
      console.log("[question-paper-call-2-blueprint] API response:", bpRaw);
      const bpParsed = tryParseApiJson<{ blueprintText?: string; error?: string; blueprintError?: string }>(
        bpRaw,
        bpRes.status,
      );

      if (!bpParsed.ok) {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                blueprintError: bpParsed.message,
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
        const msg =
          bpParsed.data.blueprintError ??
          bpParsed.data.error ??
          `Blueprint generation failed (${bpRes.status})`;
        setResult((prev) => (prev ? { ...prev, blueprintError: msg } : prev));
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
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <form onSubmit={onSubmit} className="space-y-6">
        <section className={sectionClass} style={{ borderColor: "rgba(0,198,167,0.25)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#0A1628" }}>
            Basic details
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Curriculum type</label>
              <select
                value={curriculumType}
                onChange={(e) => setCurriculumType(e.target.value)}
                className={inputClass}
                required
              >
                {CURRICULUM_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Grade</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass} required>
                {GRADE_YEAR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} required>
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Topic or chapter name</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={inputClass}
                placeholder="e.g. Photosynthesis"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Total marks</label>
              <input
                type="number"
                min={1}
                max={500}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Time allowed</label>
              <select
                value={timeAllowed}
                onChange={(e) =>
                  setTimeAllowed(e.target.value as (typeof QUESTION_PAPER_TIME_OPTIONS)[number])
                }
                className={inputClass}
              >
                {QUESTION_PAPER_TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Difficulty level</label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as (typeof QUESTION_PAPER_DIFFICULTY_OPTIONS)[number])
                }
                className={inputClass}
              >
                {QUESTION_PAPER_DIFFICULTY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={`${sectionClass} border-dashed`} style={{ borderColor: "rgba(0,198,167,0.35)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#0A1628" }}>
            Provide your content
          </h2>
          <p className="mt-1 text-xs text-slate-600">
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
            <button
              type="button"
              disabled={uploadExtracting || loading}
              onClick={() => pdfInputRef.current?.click()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Upload PDF
            </button>
            <button
              type="button"
              disabled={uploadExtracting || loading}
              onClick={() => imageInputRef.current?.click()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Upload image
            </button>
          </div>
          <textarea
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            disabled={uploadExtracting || loading}
            rows={6}
            className={`${inputClass} mt-4`}
            placeholder="Paste chapter notes, textbook extract, or teaching content…"
          />
          {uploadInfo ? <p className="mt-2 text-xs text-teal-800">{uploadInfo}</p> : null}
          {uploadedChunks.length > 0 ? (
            <p className="mt-2 text-xs text-slate-600">
              {uploadedChunks.length} file(s) attached ({extractedMaterial.length.toLocaleString()}{" "}
              chars extracted)
            </p>
          ) : null}
        </section>

        <section className={sectionClass} style={{ borderColor: "rgba(10,22,40,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#0A1628" }}>
            Question types
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {QUESTION_TYPE_SPECS.map((spec) => (
              <div
                key={spec.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{spec.label}</p>
                  <p className="text-[11px] text-slate-500">{spec.description}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={questionCounts[spec.id]}
                  onChange={(e) => setCount(spec.id, Number(e.target.value))}
                  className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm"
                  aria-label={`Count for ${spec.label}`}
                />
              </div>
            ))}
          </div>
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "#0A1628", color: "#fff" }}
          >
            <span>
              Total questions: <strong>{totalQuestions}</strong>
            </span>
            <span>
              Paper marks: <strong>{totalMarks}</strong>
            </span>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold" style={{ color: "#0A1628" }}>
            Generation mode
          </h2>
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-[#00C6A7] has-[:checked]:bg-[#00C6A7]/5">
              <input
                type="radio"
                name="genMode"
                checked={generationMode === "strict"}
                onChange={() => setGenerationMode("strict")}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-slate-900">Strictly based on my content</span>
                <span className="mt-1 block text-xs text-slate-600">
                  AI will generate questions using ONLY the content you provided. No additional
                  information will be added.
                </span>
              </span>
            </label>
            {generationMode === "strict" ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Please upload or paste your content above for best results.
              </p>
            ) : null}
            <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-[#00C6A7] has-[:checked]:bg-[#00C6A7]/5">
              <input
                type="radio"
                name="genMode"
                checked={generationMode === "enhanced"}
                onChange={() => setGenerationMode("enhanced")}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-slate-900">AI enhanced generation</span>
                <span className="mt-1 block text-xs text-slate-600">
                  AI may paraphrase and enhance questions beyond your provided content.
                </span>
              </span>
            </label>
            {generationMode === "enhanced" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                  <span>Enhancement level</span>
                  <span style={{ color: "#00C6A7" }}>{enhancementPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={enhancementPercent}
                  onChange={(e) => setEnhancementPercent(Number(e.target.value))}
                  className="mt-3 w-full accent-[#00C6A7]"
                />
                <p className="mt-2 text-[11px] text-slate-600">
                  0–20%: mostly your content · 21–50%: balanced · 51–80%: mostly AI · 81–100%: fully AI
                  from topic
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold" style={{ color: "#0A1628" }}>
            Answer key options
          </h2>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              />
              Include answer key
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={includeMarkingScheme}
                onChange={(e) => setIncludeMarkingScheme(e.target.checked)}
              />
              Include marking scheme
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={includeModelAnswers}
                onChange={(e) => setIncludeModelAnswers(e.target.checked)}
              />
              Include model answers for long questions
            </label>
          </div>
        </section>

        <section className={sectionClass} style={{ borderColor: "rgba(0,198,167,0.2)" }}>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={generateBlueprint}
              onChange={(e) => setGenerateBlueprint(e.target.checked)}
              className="mt-1 size-4 rounded border-slate-300 text-[#00C6A7] focus:ring-[#00C6A7]"
            />
            <span>
              <span className="text-sm font-semibold text-slate-900">
                Generate Blueprint with Question Paper
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                After your paper is ready, a second pass analyzes it and builds chapter-wise,
                Bloom&apos;s, question-type, and difficulty tables (plain text, not JSON).
              </span>
            </span>
          </label>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading || totalQuestions < 1}
          className="w-full rounded-xl px-6 py-4 text-base font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          style={{ background: "#00C6A7" }}
        >
          {loading ? "Generating…" : "Generate question paper"}
        </button>
        <p className="text-center text-xs text-slate-500">
          Estimated time: {timeEstimate.detail} ({timeEstimate.tier})
        </p>
      </form>

      <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
        <div
          className="min-h-[420px] rounded-2xl border shadow-sm"
          style={{ borderColor: "rgba(0,198,167,0.3)", background: "#fff" }}
        >
          <div
            className="rounded-t-2xl px-4 py-3 text-sm font-semibold text-white sm:px-5"
            style={{ background: "#0A1628" }}
          >
            Preview
          </div>
          {result?.blueprintText ? (
            <div className="flex border-b border-slate-200 bg-slate-50 px-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewTab("paper")}
                className="rounded-t-lg px-4 py-2 text-xs font-semibold transition"
                style={{
                  background: previewTab === "paper" ? "#fff" : "transparent",
                  color: previewTab === "paper" ? "#0A1628" : "#64748b",
                }}
              >
                Question paper
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("blueprint")}
                className="rounded-t-lg px-4 py-2 text-xs font-semibold transition"
                style={{
                  background: previewTab === "blueprint" ? "#fff" : "transparent",
                  color: previewTab === "blueprint" ? "#0A1628" : "#64748b",
                }}
              >
                Blueprint
              </button>
            </div>
          ) : null}
          <div className="max-h-[min(60vh,560px)] overflow-y-auto p-4 sm:p-5">
            {result ? (
              <>
                {result.parseNotice ? (
                  <p className="mb-3 text-xs text-amber-800">{result.parseNotice}</p>
                ) : null}
                {result.blueprintError ? (
                  <p className="mb-3 text-xs text-amber-800">
                    Blueprint could not be generated: {result.blueprintError}. Your question paper and
                    downloads are still available.
                  </p>
                ) : null}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                  {previewText}
                </pre>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Your generated question paper will appear here. Configure options on the left and
                click Generate.
              </p>
            )}
          </div>
        </div>

        {result && !loading ? (
          <>
            <div
              role="status"
              aria-live="polite"
              style={{
                transition: "opacity 0.4s ease, transform 0.4s ease",
                opacity: paperReady ? 1 : 0,
                transform: paperReady ? "translateY(0)" : "translateY(-8px)",
                pointerEvents: paperReady ? "auto" : "none",
              }}
              className="rounded-2xl border border-[#00C6A7]/40 bg-[#00C6A7]/10 px-4 py-3 text-sm font-semibold text-[#007a66] shadow-sm"
            >
              Your Question Paper is ready!
            </div>
            <div
              id="download-section"
              className="rounded-2xl border px-4 py-5 shadow-sm sm:px-5"
              style={{ borderColor: "rgba(0,198,167,0.3)", background: "#fff" }}
            >
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={!!downloading}
                onClick={() => downloadQuestionPaper()}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                style={{ background: "#00C6A7" }}
              >
                {downloading === "paper" ? "Downloading…" : "Download Question Paper as Word"}
              </button>
              <button
                type="button"
                disabled={!!downloading || !result.blueprintText}
                onClick={() => downloadBlueprint()}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                style={{ background: "#0A1628" }}
              >
                {downloading === "blueprint" ? "Downloading…" : "Download Blueprint as Word"}
              </button>
              <button
                type="button"
                disabled={!!downloading}
                onClick={() => downloadZip()}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #00C6A7 0%, #0A1628 100%)",
                }}
              >
                {downloading === "zip" ? "Downloading…" : "Download Complete Pack as ZIP"}
              </button>
            </div>
            </div>
          </>
        ) : null}
      </div>

      {loading ? (
        <LessonPlanLoadingGame
          active={loading}
          statusText={generationProgress}
          selectedSections={qpLoadingSections}
          preset="question-paper"
          estimatedSeconds={timeEstimate.seconds}
        />
      ) : null}
    </div>
  );
}
