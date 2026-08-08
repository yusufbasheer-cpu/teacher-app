"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  emptyDifferentiatedPack,
  type DifferentiatedPackContent,
} from "@/lib/differentiated-pack-markers";
import {
  clearDiffPackSession,
  readDiffPackSession,
} from "@/lib/differentiated-pack-session";
import { triggerFileDownload } from "@/lib/trigger-file-download";
import { filterUserFacingNotices } from "@/lib/image-notices";
import { tryParseApiJson } from "@/lib/try-parse-api-json";
import { toUserFacingError, USER_FACING_ERROR } from "@/lib/user-facing-errors";
import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";

function safeFilePart(topic: string) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "lesson";
}

export function DifferentiatedWorksheetPack() {
  type Level = "foundation" | "core" | "extension";
  type LevelProgress = "idle" | "loading" | "success" | "error";

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [curriculumType, setCurriculumType] = useState("");
  const [curriculumFramework, setCurriculumFramework] = useState("");
  const [lessonSourceText, setLessonSourceText] = useState("");

  const [fromLessonNotice, setFromLessonNotice] = useState<string | null>(null);
  const [pack, setPack] = useState<DifferentiatedPackContent | null>(null);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [levelProgress, setLevelProgress] = useState<Record<Level, LevelProgress>>({
    foundation: "idle",
    core: "idle",
    extension: "idle",
  });
  const [extracting, setExtracting] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const mergeLevelResult = (
    current: DifferentiatedPackContent,
    incoming: DifferentiatedPackContent,
  ): DifferentiatedPackContent => {
    const next = { ...current };
    if (incoming.foundation.trim()) next.foundation = incoming.foundation.trim();
    if (incoming.core.trim()) next.core = incoming.core.trim();
    if (incoming.extension.trim()) next.extension = incoming.extension.trim();

    const appendWithHeader = (existing: string, add: string, header: string) => {
      const trimmed = add.trim();
      if (!trimmed) return existing;
      const block = `## ${header}\n\n${trimmed}`;
      return existing.trim() ? `${existing.trim()}\n\n---\n\n${block}` : block;
    };

    if (incoming.answerKey.trim()) {
      const header =
        incoming.foundation.trim() ? "Foundation" : incoming.core.trim() ? "Core" : "Extension";
      next.answerKey = appendWithHeader(next.answerKey, incoming.answerKey, header);
    }
    if (incoming.rubrics.trim()) {
      const header =
        incoming.foundation.trim() ? "Foundation" : incoming.core.trim() ? "Core" : "Extension";
      next.rubrics = appendWithHeader(next.rubrics, incoming.rubrics, header);
    }
    if (incoming.teacherNotes.trim()) {
      const header =
        incoming.foundation.trim() ? "Foundation" : incoming.core.trim() ? "Core" : "Extension";
      next.teacherNotes = appendWithHeader(next.teacherNotes, incoming.teacherNotes, header);
    }
    if (incoming.selfAssessment.trim()) {
      const header =
        incoming.foundation.trim() ? "Foundation" : incoming.core.trim() ? "Core" : "Extension";
      next.selfAssessment = appendWithHeader(next.selfAssessment, incoming.selfAssessment, header);
    }
    if (incoming.peerAssessment.trim()) {
      const header =
        incoming.foundation.trim() ? "Foundation" : incoming.core.trim() ? "Core" : "Extension";
      next.peerAssessment = appendWithHeader(next.peerAssessment, incoming.peerAssessment, header);
    }

    return next;
  };

  useEffect(() => {
    const session = readDiffPackSession();
    if (!session) return;
    setTopic(session.topic);
    setSubject(session.subject);
    setGrade(session.grade);
    setLearningObjectives(session.learningObjectives);
    setCurriculumType(session.curriculumType ?? "");
    setCurriculumFramework(session.curriculumFramework ?? "");
    setLessonSourceText(session.lessonSourceText);
    setFromLessonNotice("Loaded context from your generated lesson plan. Review the fields below, then generate the pack.");
  }, []);

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

  const onGenerate = async () => {
    setError(null);
    setParseNotice(null);
    setPack(null);
    setLevelProgress({ foundation: "idle", core: "idle", extension: "idle" });
    if (!topic.trim() || !subject.trim() || !grade.trim() || !learningObjectives.trim()) {
      setError("Please fill topic, subject, grade, and learning objectives.");
      return;
    }
    if (!lessonSourceText.trim()) {
      setError("Add lesson source text (from your plan or an uploaded document).");
      return;
    }
    setLoading(true);
    try {
      const levels: Level[] = ["foundation", "core", "extension"];
      const notices: string[] = [];
      const failures: string[] = [];
      let combined = emptyDifferentiatedPack();
      let succeeded = 0;

      for (const level of levels) {
        setLevelProgress((prev) => ({ ...prev, [level]: "loading" }));
        const res = await fetch("/api/differentiated-pack", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            level,
            topic: topic.trim(),
            subject: subject.trim(),
            grade: grade.trim(),
            learningObjectives: learningObjectives.trim(),
            curriculumType: curriculumType.trim() || undefined,
            curriculumFramework: curriculumFramework.trim() || undefined,
            lessonSourceText: lessonSourceText.trim(),
          }),
        });
        const raw = await res.text();
        console.log(
          "[differentiated-pack client]",
          level,
          "HTTP",
          res.status,
          "body length",
          raw.length,
          "\npreview:\n",
          raw.slice(0, 800),
        );

        type DiffPackApi = {
          error?: string;
          pack?: DifferentiatedPackContent;
          parseNotice?: string;
          recoveryNotice?: string;
          rawResponse?: string;
          httpStatus?: number;
        };

        const parsed = tryParseApiJson<DiffPackApi>(raw, res.status, `diff-pack-${level}`);
        if (!parsed.ok) {
          setLevelProgress((prev) => ({ ...prev, [level]: "error" }));
          if (parsed.rawPreview) {
            console.error(`[diff-pack-${level}] parse error, preview length:`, parsed.rawPreview.length);
          }
          failures.push(level);
          continue;
        }
        const data = parsed.data;

        if (!res.ok || !data.pack) {
          setLevelProgress((prev) => ({ ...prev, [level]: "error" }));
          console.error(`[diff-pack-${level}] generation failed`, {
            status: res.status,
            error: data.error,
            rawLength: data.rawResponse?.length ?? raw.length,
          });
          failures.push(level);
          continue;
        }

        combined = mergeLevelResult(combined, data.pack);
        succeeded += 1;
        setLevelProgress((prev) => ({ ...prev, [level]: "success" }));
        if (data.parseNotice) notices.push(`${level}: ${data.parseNotice}`);
        if (data.recoveryNotice) notices.push(`${level}: ${data.recoveryNotice}`);
      }

      if (succeeded === 0) {
        console.error("[differentiated-pack] all levels failed", failures);
        throw new Error(USER_FACING_ERROR);
      }

      setPack(combined);
      const safeNotices = filterUserFacingNotices(notices);
      setParseNotice(safeNotices.length ? safeNotices.join(" ") : null);
      if (failures.length) {
        console.warn("[differentiated-pack] partial level failures:", failures);
        setError("Some levels could not be generated. Successful levels are shown below.");
      }
    } catch (e) {
      setError(toUserFacingError(e, "differentiated-pack-generate"));
    } finally {
      setLoading(false);
    }
  };

  const onExtractUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const file = fileList[0];
    if (!file) return;
    setError(null);
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/differentiated-pack/extract", {
        method: "POST",
        headers: await getAuthOnlyHeaders(),
        body: fd,
      });
      const raw = await res.text();
      console.log("[differentiated-pack extract client] HTTP", res.status, "len", raw.length);
      type ExtractApi = { error?: string; extractedText?: string };
      const parsed = tryParseApiJson<ExtractApi>(raw, res.status, "diff-pack-extract");
      if (!parsed.ok) throw new Error(parsed.message);
      const data = parsed.data;
      if (!res.ok) {
        console.error("[diff-pack-extract]", data.error);
        throw new Error(USER_FACING_ERROR);
      }
      if (!data.extractedText?.trim()) throw new Error(USER_FACING_ERROR);
      setLessonSourceText(data.extractedText);
    } catch (e) {
      setError(toUserFacingError(e, "diff-pack-extract"));
    } finally {
      setExtracting(false);
    }
  };

  const onInferMeta = async () => {
    if (!lessonSourceText.trim()) {
      setError("Upload or paste lesson content first.");
      return;
    }
    setError(null);
    setParseNotice(null);
    setInferring(true);
    try {
      const res = await fetch("/api/differentiated-pack/infer-meta", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ rawText: lessonSourceText.trim() }),
      });
      const raw = await res.text();
      console.log("[infer-meta client] HTTP", res.status, "len", raw.length);

      type InferMetaApi = {
        error?: string;
        topic?: string;
        subject?: string;
        grade?: string;
        learningObjectives?: string;
        parseNotice?: string;
        rawResponse?: string;
      };

      const parsed = tryParseApiJson<InferMetaApi>(raw, res.status, "diff-pack-infer-meta");
      if (!parsed.ok) throw new Error(parsed.message);
      const data = parsed.data;

      if (!res.ok) {
        console.error("[diff-pack-infer-meta]", data.error, {
          rawLength: data.rawResponse?.length ?? 0,
        });
        throw new Error(USER_FACING_ERROR);
      }

      const safeInferNotices = filterUserFacingNotices(
        data.parseNotice?.trim() ? [data.parseNotice.trim()] : [],
      );
      setParseNotice(safeInferNotices.length ? safeInferNotices.join(" ") : null);
      if (data.topic) setTopic(data.topic);
      if (data.subject) setSubject(data.subject);
      if (data.grade) setGrade(data.grade);
      if (data.learningObjectives) setLearningObjectives(data.learningObjectives);
    } catch (e) {
      setError(toUserFacingError(e, "diff-pack-infer-meta"));
    } finally {
      setInferring(false);
    }
  };

  const downloadDocx = async (
    key: string,
    documentTitle: string,
    fileBaseName: string,
    content: string,
  ) => {
    setBusyDownload(key);
    setError(null);
    try {
      const res = await fetch("/api/differentiated-pack/export-docx", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          documentTitle,
          fileBaseName,
          subject: subject.trim(),
          grade: grade.trim(),
          topic: topic.trim(),
          content,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Download failed.");
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Empty file.");
      triggerFileDownload(blob, `${safeFilePart(topic)}-${fileBaseName}.docx`);
    } catch (e) {
      setError(toUserFacingError(e, "diff-pack-download"));
    } finally {
      setBusyDownload(null);
    }
  };

  const downloadZip = async () => {
    if (!pack) return;
    setBusyDownload("zip");
    setError(null);
    try {
      const res = await fetch("/api/differentiated-pack/export-zip", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          subject: subject.trim(),
          grade: grade.trim(),
          topic: topic.trim(),
          pack,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "ZIP failed.");
      }
      const blob = await res.blob();
      triggerFileDownload(blob, `${safeFilePart(topic)}-differentiated-pack.zip`);
    } catch (e) {
      setError(toUserFacingError(e, "diff-pack-zip"));
    } finally {
      setBusyDownload(null);
    }
  };

  const base = safeFilePart(topic);

  if (checkingAuth) {
    return (
      <div className="mx-auto w-full max-w-[820px] rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Checking your account…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[820px] rounded-3xl border border-[#00C6A7]/20 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Login required</h2>
        <p className="mt-2 text-sm text-slate-600">
          Please log in to generate differentiated worksheet packs and track your monthly generation limit.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-slate-900">How to use this pack</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>
            <strong className="text-emerald-800">Way 1:</strong> After generating a lesson in{" "}
            <em>Generate Lesson Plan</em>, use the button there to send your plan here, then click{" "}
            <strong>Generate differentiated pack</strong> below.
          </li>
          <li>
            <strong className="text-[#0A1628]">Way 2:</strong> Upload a PDF or Word (.docx) lesson plan,
            extract text, optionally <strong>Auto-fill form</strong>, edit fields, then generate.
          </li>
        </ul>
      </div>

      {fromLessonNotice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {fromLessonNotice}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">Way 1</h3>
          <p className="mt-1 text-sm text-slate-700">Generate from the lesson you just built in EduPlan.</p>
          <p className="mt-3 text-xs text-slate-600">
            Use the <strong>Generate Differentiated Worksheet Pack</strong> button on the lesson
            generator page after a successful run. It fills this page automatically.
          </p>
        </section>
        <section className="rounded-2xl border-2 border-[#00C6A7]/30 bg-[#00C6A7]/5 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#0A1628]">Way 2</h3>
          <p className="mt-1 text-sm text-slate-700">Upload an existing lesson plan (PDF or .docx).</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={extracting}
              onChange={(e) => void onExtractUpload(e.target.files)}
              className="block w-full min-w-0 text-sm text-slate-800 file:mr-2 file:rounded-lg file:border-0 file:bg-[#00C6A7] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            />
          </div>
          {extracting ? (
            <p className="mt-2 text-xs font-medium text-[#0A1628]">Extracting text…</p>
          ) : null}
          <button
            type="button"
            disabled={inferring || !lessonSourceText.trim()}
            onClick={() => void onInferMeta()}
            className="mt-4 rounded-lg border border-[#00C6A7]/40 bg-white px-3 py-2 text-xs font-semibold text-[#0A1628] shadow-sm hover:bg-[#00C6A7]/10 disabled:opacity-50"
          >
            {inferring ? "Inferring…" : "Auto-fill form from document"}
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900">Class details &amp; lesson source</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Topic</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Grade / year</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">Learning objectives</label>
            <textarea
              value={learningObjectives}
              onChange={(e) => setLearningObjectives(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Curriculum type (optional)</label>
            <input
              value={curriculumType}
              onChange={(e) => setCurriculumType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. CBSE/NCERT"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Framework (optional)</label>
            <input
              value={curriculumFramework}
              onChange={(e) => setCurriculumFramework(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Framework id or leave blank"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Lesson source (full lesson plan text)
            </label>
            <textarea
              value={lessonSourceText}
              onChange={(e) => setLessonSourceText(e.target.value)}
              rows={14}
              spellCheck={false}
              className="max-h-96 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed"
              placeholder="Paste lesson plan text, or upload a PDF / Word file (Way 2)."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void onGenerate()}
            className="inline-flex min-h-11 items-center rounded-xl bg-[#00C6A7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0A8F7A] disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate differentiated pack"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearDiffPackSession();
              setFromLessonNotice(null);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear “from lesson” session
          </button>
        </div>
        <div className="mt-3 space-y-1 text-xs">
          <p className="text-slate-700">
            Generating Foundation worksheet…{" "}
            {levelProgress.foundation === "loading"
              ? "⏳"
              : levelProgress.foundation === "success"
                ? "✅"
                : levelProgress.foundation === "error"
                  ? "❌"
                  : "—"}
          </p>
          <p className="text-slate-700">
            Generating Core worksheet…{" "}
            {levelProgress.core === "loading"
              ? "⏳"
              : levelProgress.core === "success"
                ? "✅"
                : levelProgress.core === "error"
                  ? "❌"
                  : "—"}
          </p>
          <p className="text-slate-700">
            Generating Extension worksheet…{" "}
            {levelProgress.extension === "loading"
              ? "⏳"
              : levelProgress.extension === "success"
                ? "✅"
                : levelProgress.extension === "error"
                  ? "❌"
                  : "—"}
          </p>
        </div>
      </section>

      {parseNotice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {parseNotice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm whitespace-pre-wrap break-words text-red-900">
          {error}
        </p>
      ) : null}

      {pack ? (
        <>
          <section>
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Preview</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex min-h-[14rem] flex-col rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 shadow-sm">
                <div className="rounded-t-xl bg-emerald-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
                  Foundation
                </div>
                <pre className="max-h-80 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-sans text-xs leading-relaxed text-slate-800">
                  {pack.foundation.trim() || "(Empty)"}
                </pre>
              </div>
              <div className="flex min-h-[14rem] flex-col rounded-2xl border-2 border-[#00C6A7] bg-[#00C6A7]/5 shadow-sm">
                <div className="rounded-t-xl bg-[#00C6A7] px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
                  Core
                </div>
                <pre className="max-h-80 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-sans text-xs leading-relaxed text-slate-800">
                  {pack.core.trim() || "(Empty)"}
                </pre>
              </div>
              <div className="flex min-h-[14rem] flex-col rounded-2xl border-2 border-violet-500 bg-violet-50/50 shadow-sm">
                <div className="rounded-t-xl bg-violet-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
                  Extension
                </div>
                <pre className="max-h-80 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-3 font-sans text-xs leading-relaxed text-slate-800">
                  {pack.extension.trim() || "(Empty)"}
                </pre>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Downloads</h3>
            <p className="mt-1 text-xs text-slate-600">
              Main worksheets and answer key download individually; rubrics, teacher notes, and
              assessment sheets download below or inside the ZIP.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pack.foundation.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("f", "Foundation Worksheet", "foundation", pack.foundation)
                  }
                  className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {busyDownload === "f" ? "…" : "Foundation (.docx)"}
                </button>
              ) : null}
              {pack.core.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() => void downloadDocx("c", "Core Worksheet", "core", pack.core)}
                  className="rounded-lg border border-[#00C6A7] bg-white px-3 py-2 text-xs font-semibold text-[#0A1628] hover:bg-[#00C6A7]/10 disabled:opacity-50"
                >
                  {busyDownload === "c" ? "…" : "Core (.docx)"}
                </button>
              ) : null}
              {pack.extension.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("e", "Extension Worksheet", "extension", pack.extension)
                  }
                  className="rounded-lg border border-violet-600 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                >
                  {busyDownload === "e" ? "…" : "Extension (.docx)"}
                </button>
              ) : null}
              {pack.answerKey.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("a", "Answer Key (all levels)", "answer-key", pack.answerKey)
                  }
                  className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyDownload === "a" ? "…" : "Answer key (.docx)"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busyDownload !== null}
                onClick={() => void downloadZip()}
                className="rounded-lg bg-[#00C6A7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A8F7A] disabled:opacity-50"
              >
                {busyDownload === "zip" ? "Building…" : "Complete pack (.zip)"}
              </button>
            </div>
            <p className="mt-4 text-xs font-medium text-slate-700">Teacher resources (.docx)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pack.rubrics.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("r", "Marking rubrics (all levels)", "rubrics", pack.rubrics)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyDownload === "r" ? "…" : "Rubrics"}
                </button>
              ) : null}
              {pack.teacherNotes.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("t", "Teacher notes", "teacher-notes", pack.teacherNotes)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyDownload === "t" ? "…" : "Teacher notes"}
                </button>
              ) : null}
              {pack.selfAssessment.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx(
                      "s",
                      "Student self-assessment checklist",
                      "self-assessment",
                      pack.selfAssessment,
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyDownload === "s" ? "…" : "Self-assessment"}
                </button>
              ) : null}
              {pack.peerAssessment.trim() ? (
                <button
                  type="button"
                  disabled={busyDownload !== null}
                  onClick={() =>
                    void downloadDocx("p", "Peer assessment sheet", "peer-assessment", pack.peerAssessment)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyDownload === "p" ? "…" : "Peer assessment"}
                </button>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
