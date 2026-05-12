"use client";

import { useEffect, useState } from "react";
import type { DifferentiatedPackContent } from "@/lib/differentiated-pack-markers";
import {
  clearDiffPackSession,
  readDiffPackSession,
} from "@/lib/differentiated-pack-session";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilePart(topic: string) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "lesson";
}

export function DifferentiatedWorksheetPack() {
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
  const [extracting, setExtracting] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);

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

  const onGenerate = async () => {
    setError(null);
    setParseNotice(null);
    setPack(null);
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
      const res = await fetch("/api/differentiated-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: subject.trim(),
          grade: grade.trim(),
          learningObjectives: learningObjectives.trim(),
          curriculumType: curriculumType.trim() || undefined,
          curriculumFramework: curriculumFramework.trim() || undefined,
          lessonSourceText: lessonSourceText.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pack?: DifferentiatedPackContent;
        parseNotice?: string;
        recoveryNotice?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      if (!data.pack) throw new Error("No pack returned.");
      setPack(data.pack);
      setParseNotice(
        [data.parseNotice, data.recoveryNotice].filter(Boolean).join(" ") || null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
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
      const res = await fetch("/api/differentiated-pack/extract", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; extractedText?: string };
      if (!res.ok) throw new Error(data.error ?? "Extract failed.");
      if (!data.extractedText?.trim()) throw new Error("No text extracted.");
      setLessonSourceText(data.extractedText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extract failed.");
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
    setInferring(true);
    try {
      const res = await fetch("/api/differentiated-pack/infer-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: lessonSourceText.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        topic?: string;
        subject?: string;
        grade?: string;
        learningObjectives?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not infer fields.");
      if (data.topic) setTopic(data.topic);
      if (data.subject) setSubject(data.subject);
      if (data.grade) setGrade(data.grade);
      if (data.learningObjectives) setLearningObjectives(data.learningObjectives);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Infer failed.");
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
        headers: { "Content-Type": "application/json" },
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
      triggerDownload(blob, `${safeFilePart(topic)}-${fileBaseName}.docx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
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
        headers: { "Content-Type": "application/json" },
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
      triggerDownload(blob, `${safeFilePart(topic)}-differentiated-pack.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ZIP failed.");
    } finally {
      setBusyDownload(null);
    }
  };

  const base = safeFilePart(topic);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-slate-900">How to use this pack</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          <li>
            <strong className="text-emerald-800">Way 1:</strong> After generating a lesson in{" "}
            <em>Generate Lesson Plan</em>, use the button there to send your plan here, then click{" "}
            <strong>Generate differentiated pack</strong> below.
          </li>
          <li>
            <strong className="text-blue-800">Way 2:</strong> Upload a PDF or Word (.docx) lesson plan,
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
        <section className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">Way 2</h3>
          <p className="mt-1 text-sm text-slate-700">Upload an existing lesson plan (PDF or .docx).</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={extracting}
              onChange={(e) => void onExtractUpload(e.target.files)}
              className="block w-full min-w-0 text-sm text-slate-800 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            />
          </div>
          {extracting ? (
            <p className="mt-2 text-xs font-medium text-blue-800">Extracting text…</p>
          ) : null}
          <button
            type="button"
            disabled={inferring || !lessonSourceText.trim()}
            onClick={() => void onInferMeta()}
            className="mt-4 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50 disabled:opacity-50"
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
            className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
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
      </section>

      {parseNotice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {parseNotice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
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
              <div className="flex min-h-[14rem] flex-col rounded-2xl border-2 border-blue-500 bg-blue-50/50 shadow-sm">
                <div className="rounded-t-xl bg-blue-600 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
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
                  className="rounded-lg border border-blue-600 bg-white px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
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
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
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
