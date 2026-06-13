"use client";

import { useState } from "react";
import { generateLessonPdf, type PdfContentSection } from "@/lib/pdf-generator";

export type PdfSectionKey = "lesson" | "worksheet" | "assessment" | "notes" | "objectives";

interface PdfSection {
  key: PdfSectionKey;
  label: string;
  heading: string;
  content: string;
}

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  grade: string;
  topic: string;
  curriculumType?: string;
  teacherName?: string;
  teachingStrategy?: string;
  availableSections: PdfSection[];
}

export function PdfModal({
  isOpen,
  onClose,
  subject,
  grade,
  topic,
  curriculumType,
  teacherName,
  teachingStrategy,
  availableSections,
}: PdfModalProps) {
  const [selected, setSelected] = useState<Set<PdfSectionKey>>(
    () => new Set(availableSections.map((s) => s.key)),
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toggle = (key: PdfSectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDownload = async () => {
    const sections: PdfContentSection[] = availableSections
      .filter((s) => selected.has(s.key))
      .map((s) => ({ heading: s.heading, content: s.content }));

    if (sections.length === 0) return;

    setLoading(true);
    try {
      await generateLessonPdf({
        sections,
        subject,
        grade,
        topic,
        curriculumType,
        teacherName,
        teachingStrategy,
      });
      onClose();
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const allSelected = availableSections.every((s) => selected.has(s.key));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableSections.map((s) => s.key)));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,22,40,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pdf-modal-title">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "rgba(0,198,167,0.1)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00C6A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h2 id="pdf-modal-title" className="text-base font-bold" style={{ color: "#0A1628" }}>
              Download PDF
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="mb-4 text-sm" style={{ color: "#6B7280" }}>
            Select the sections to include in your PDF:
          </p>

          {/* Select all */}
          <button
            onClick={toggleAll}
            className="mb-3 text-xs font-semibold transition hover:underline"
            style={{ color: "#00C6A7" }}
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <div className="space-y-2">
            {availableSections.map((section) => {
              const isChecked = selected.has(section.key);
              return (
                <label
                  key={section.key}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition hover:border-teal-300"
                  style={{
                    borderColor: isChecked ? "#00C6A7" : "#E5E7EB",
                    background: isChecked ? "rgba(0,198,167,0.04)" : "white",
                  }}
                >
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
                    style={{
                      background: isChecked ? "#00C6A7" : "white",
                      border: isChecked ? "none" : "2px solid #D1D5DB",
                    }}
                  >
                    {isChecked && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggle(section.key)}
                  />
                  <span className="text-sm font-medium" style={{ color: "#374151" }}>
                    {section.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(0,198,167,0.15)" }}>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || selected.size === 0}
            className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: "#00C6A7" }}
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
