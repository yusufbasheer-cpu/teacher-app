"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type LessonPlanLoadingGameProps = {
  active: boolean;
  statusText?: string | null;
  /**
   * The teacher's section selection from the generator form.
   * Only sections whose value is `true` will appear in the checklist.
   * If omitted, all sections are shown (safe fallback).
   */
  selectedSections?: Record<string, boolean> | null;
};

// ── Fun facts ─────────────────────────────────────────────────────────────────
const FUN_FACTS = [
  "The word 'school' comes from the Greek word 'skholē' meaning leisure.",
  "The first pencil was made in England in 1565.",
  "Albert Einstein failed his first university entrance exam.",
  "The average person spends 6 months of their lifetime waiting for red lights.",
  "Honey never expires — archaeologists found 3,000-year-old honey in Egyptian tombs.",
  "A group of flamingos is called a flamboyance.",
  "The moon is moving away from Earth at 3.8 cm per year.",
  "Octopuses have three hearts and blue blood.",
  "The first computer bug was an actual bug — a moth found inside a computer in 1947.",
  "Bananas are technically berries, but strawberries are not.",
  "The human brain generates enough electricity to power a small light bulb.",
  "A day on Venus is longer than a year on Venus.",
  "The Eiffel Tower grows 15 cm taller in summer due to heat expansion.",
  "There are more possible chess games than atoms in the observable universe.",
  "The first mobile phone call was made in 1973 by Martin Cooper.",
  "A bolt of lightning is five times hotter than the surface of the sun.",
  "Sharks are older than trees — they have existed for over 400 million years.",
  "The word 'quiz' was reportedly invented overnight as a bet in Dublin in 1791.",
  "It takes 8 minutes and 20 seconds for light to travel from the sun to Earth.",
  "Wombats produce cube-shaped droppings — the only animal known to do this.",
];

// ── Section checklist definition ─────────────────────────────────────────────
type SectionStatus = "waiting" | "generating" | "done";

/**
 * `sectionKey` matches the TeacherPackageSectionKey keys used in the generator's
 * `sectionSelection` state so we can filter the checklist by what was selected.
 */
const SECTIONS: { key: string; sectionKey: string; label: string; keywords: string[] }[] = [
  { key: "lesson",     sectionKey: "Full Lesson Plan",      label: "Lesson Plan",         keywords: ["lesson plan", "full lesson", "lesson content"] },
  { key: "ppt",        sectionKey: "PPT Slide Content",     label: "PPT Content",          keywords: ["ppt", "slide", "presentation", "deck"] },
  { key: "worksheet",  sectionKey: "Worksheet",             label: "Worksheet",            keywords: ["worksheet"] },
  { key: "assessment", sectionKey: "Assessment Questions",  label: "Assessment Questions", keywords: ["assessment", "quiz", "question"] },
  { key: "homework",   sectionKey: "Homework Task",         label: "Homework Task",        keywords: ["homework", "home task", "extended task"] },
  { key: "notes",      sectionKey: "Teacher Notes",         label: "Teacher Notes",        keywords: ["teacher note", "notes"] },
  { key: "afl",        sectionKey: "AFL Activity Sheets",   label: "AFL Activity Sheets",  keywords: ["afl", "activity sheet", "printable"] },
];

const emptyStatuses = (): Record<string, SectionStatus> =>
  Object.fromEntries(SECTIONS.map((s) => [s.key, "waiting"])) as Record<string, SectionStatus>;

function detectActiveSection(text: string): string | null {
  const lower = text.toLowerCase();
  for (const s of SECTIONS) {
    if (s.keywords.some((k) => lower.includes(k))) return s.key;
  }
  return null;
}

function computeProgress(
  statuses: Record<string, SectionStatus>,
  statusText: string | null | undefined,
  activeSections: typeof SECTIONS,
): number {
  const total = activeSections.length;
  if (total === 0) return 4;

  const doneCount = activeSections.filter((s) => statuses[s.key] === "done").length;
  const genIdx    = activeSections.findIndex((s) => statuses[s.key] === "generating");
  let base = (doneCount / total) * 92;

  // Boost within slide generation using slide X/Y in statusText
  if (genIdx >= 0 && statusText) {
    const m = statusText.match(/(\d+)\s*[/of]+\s*(\d+)/);
    if (m) {
      const num   = parseInt(m[1]!, 10);
      const tot   = parseInt(m[2]!, 10);
      if (tot > 0) {
        const sectionShare = 92 / total;
        base += (num / tot) * sectionShare;
      }
    } else {
      base += (1 / total) * 46; // half a section's worth
    }
  }

  return Math.min(92, base);
}

// ── Layah wordmark (inline SVG, no external file needed) ─────────────────────
function LayahLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
        style={{ background: "#00C6A7" }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M11 3L4 8v10h5v-5h4v5h5V8L11 3z" fill="white" opacity="0.95" />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-white">Layah<span style={{ color: "#00C6A7" }}>.ai</span></span>
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return (
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "#00C6A7" }}
        aria-label="Done"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
        style={{ borderColor: "#00C6A7" }}
        aria-label="Generating"
      >
        <span
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ background: "#00C6A7" }}
        />
      </span>
    );
  }
  return (
    <span
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: "rgba(255,255,255,0.15)" }}
      aria-label="Waiting"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LessonPlanLoadingGame({ active, statusText, selectedSections }: LessonPlanLoadingGameProps) {
  // Filter to only sections the teacher selected; fall back to all if nothing passed
  const activeSections =
    selectedSections && Object.values(selectedSections).some(Boolean)
      ? SECTIONS.filter((s) => selectedSections[s.sectionKey] === true)
      : SECTIONS;

  const [factIdx, setFactIdx]               = useState(0);
  const [statuses, setStatuses]             = useState<Record<string, SectionStatus>>(emptyStatuses());
  const [smoothProgress, setSmoothProgress] = useState(4);
  const lastActiveSectionRef = useRef<string | null>(null);
  const targetProgressRef    = useRef(4);
  const rafRef               = useRef<number | null>(null);

  // ── Reset when generation starts ────────────────────────────────────────
  useEffect(() => {
    if (active) {
      setStatuses(emptyStatuses());
      setSmoothProgress(4);
      targetProgressRef.current = 4;
      lastActiveSectionRef.current = null;
      setFactIdx(Math.floor(Math.random() * FUN_FACTS.length));
    }
  }, [active]);

  // ── Rotate fun facts every 5 s ──────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 5000);
    return () => clearInterval(id);
  }, [active]);

  // ── Parse statusText → update checklist (only active sections) ──────────
  useEffect(() => {
    if (!statusText || !active) return;
    const found = detectActiveSection(statusText);
    if (!found) return;

    // Only act if this section is in the filtered active list
    const foundIdx = activeSections.findIndex((s) => s.key === found);
    if (foundIdx === -1) return;

    setStatuses((prev) => {
      const next = { ...prev };
      // Mark earlier active sections as done
      for (let i = 0; i < foundIdx; i++) {
        const k = activeSections[i]!.key;
        if (next[k] !== "done") next[k] = "done";
      }
      // Mark current section as generating
      next[found] = "generating";
      // Mark later active sections as waiting (unless already done)
      for (let i = foundIdx + 1; i < activeSections.length; i++) {
        const k = activeSections[i]!.key;
        if (next[k] !== "done") next[k] = "waiting";
      }
      return next;
    });

    lastActiveSectionRef.current = found;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusText, active]);

  // ── Smooth progress bar animation ───────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const tick = () => {
      const target = computeProgress(statuses, statusText, activeSections);
      targetProgressRef.current = target;
      setSmoothProgress((prev) => {
        const diff = targetProgressRef.current - prev;
        if (Math.abs(diff) < 0.1) return targetProgressRef.current;
        return prev + diff * 0.07; // ease toward target
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, statuses, statusText]);

  // ── Slow auto-increment so bar never looks stuck ─────────────────────────
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSmoothProgress((p) => Math.min(p + 0.18, 92));
    }, 800);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const pct = Math.round(smoothProgress);
  const doneCount = activeSections.filter((s) => statuses[s.key] === "done").length;
  const currentLabel =
    activeSections.find((s) => statuses[s.key] === "generating")?.label ??
    (doneCount > 0 ? "Finishing up…" : "Starting generation…");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(10,22,40,0.96)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Generating your lesson plan"
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(0,198,167,0.18)",
        }}
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <LayahLogo />
        </div>

        {/* Headline */}
        <p className="mb-1 text-center text-base font-semibold text-white">
          Crafting your lesson package
        </p>
        <p
          className="mb-5 text-center text-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {currentLabel}
        </p>

        {/* Progress bar */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: "#00C6A7" }}>
            Progress
          </span>
          <span className="text-xs font-bold tabular-nums text-white">
            {pct}%
          </span>
        </div>
        <div
          className="mb-6 h-2 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${smoothProgress}%`,
              background: "linear-gradient(90deg, #00C6A7, #00e8c3)",
            }}
          />
        </div>

        {/* Section checklist — only the sections the teacher selected */}
        <div className="mb-6 space-y-2.5">
          {activeSections.map((s) => {
            const status = statuses[s.key] ?? "waiting";
            const isActive = status === "generating";
            return (
              <div key={s.key} className="flex items-center gap-3">
                <StatusIcon status={status} />
                <span
                  className={`text-sm transition-colors duration-300 ${
                    status === "done"
                      ? "line-through"
                      : isActive
                        ? "font-semibold text-white"
                        : ""
                  }`}
                  style={{
                    color:
                      status === "done"
                        ? "rgba(255,255,255,0.35)"
                        : isActive
                          ? "#ffffff"
                          : "rgba(255,255,255,0.5)",
                  }}
                >
                  {s.label}
                </span>
                {isActive && (
                  <span
                    className="ml-auto text-xs font-medium"
                    style={{ color: "#00C6A7" }}
                  >
                    Generating…
                  </span>
                )}
                {status === "done" && (
                  <span
                    className="ml-auto text-xs font-medium"
                    style={{ color: "#00C6A7" }}
                  >
                    Done
                  </span>
                )}
                {status === "waiting" && (
                  <span
                    className="ml-auto text-xs"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                  >
                    Waiting
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div
          className="mb-4 h-px w-full"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />

        {/* Rotating fun fact */}
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex-shrink-0 text-base"
            aria-hidden
          >
            💡
          </span>
          <p
            key={factIdx}
            className="animate-fade-in text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
              Did you know?&nbsp;
            </span>
            {FUN_FACTS[factIdx]}
          </p>
        </div>
      </div>
    </div>
  );
}
