"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export type LoadingGamePreset = "lesson-plan" | "question-paper";

type SectionDef = {
  key: string;
  sectionKey: string;
  label: string;
  keywords: string[];
};

type LessonPlanLoadingGameProps = {
  active: boolean;
  statusText?: string | null;
  selectedSections?: Record<string, boolean> | null;
  /** Reuse this overlay for question paper generation (custom checklist + copy). */
  preset?: LoadingGamePreset;
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

// ── Section checklist ─────────────────────────────────────────────────────────
type SectionStatus = "waiting" | "generating" | "done";

const SECTIONS: SectionDef[] = [
  { key: "lesson",     sectionKey: "Full Lesson Plan",     label: "Lesson Plan",         keywords: ["lesson plan", "full lesson", "lesson content"] },
  { key: "ppt",        sectionKey: "PPT Slide Content",    label: "PPT Content",          keywords: ["ppt", "slide", "presentation", "deck"] },
  { key: "worksheet",  sectionKey: "Worksheet",            label: "Worksheet",            keywords: ["worksheet"] },
  { key: "assessment", sectionKey: "Assessment Questions", label: "Assessment Questions", keywords: ["assessment", "quiz", "question"] },
  { key: "homework",   sectionKey: "Homework Task",        label: "Homework Task",        keywords: ["homework", "home task", "extended task"] },
  { key: "notes",      sectionKey: "Teacher Notes",        label: "Teacher Notes",        keywords: ["teacher note", "notes"] },
  {
    key: "afl",
    sectionKey: "AFL Activity Sheets",
    label: "Activity Sheet AFL",
    keywords: ["afl activity", "afl", "activity sheet", "printable"],
  },
];

/** Question paper generator checklist (same overlay component). */
export const QUESTION_PAPER_LOADING_SECTIONS: SectionDef[] = [
  {
    key: "paper",
    sectionKey: "qp-paper",
    label: "Generating Question Paper",
    keywords: ["question paper", "generating question"],
  },
  {
    key: "blueprint",
    sectionKey: "qp-blueprint",
    label: "Generating Blueprint",
    keywords: ["blueprint", "generating blueprint"],
  },
  {
    key: "downloads",
    sectionKey: "qp-downloads",
    label: "Preparing Downloads",
    keywords: ["preparing download", "download", "finaliz"],
  },
];

function sectionCatalogForPreset(preset: LoadingGamePreset): SectionDef[] {
  return preset === "question-paper" ? QUESTION_PAPER_LOADING_SECTIONS : SECTIONS;
}

const emptyStatusesFor = (sections: SectionDef[]): Record<string, SectionStatus> =>
  Object.fromEntries(sections.map((s) => [s.key, "waiting"])) as Record<string, SectionStatus>;

function detectActiveSection(text: string, sections: SectionDef[]): string | null {
  const lower = text.toLowerCase();
  for (const s of sections) {
    if (s.keywords.some((k) => lower.includes(k))) return s.key;
  }
  return null;
}

function computeProgress(
  statuses: Record<string, SectionStatus>,
  statusText: string | null | undefined,
  activeSections: SectionDef[],
): number {
  const total = activeSections.length;
  if (total === 0) return 4;

  if (statusText && statusText.toLowerCase().includes("finaliz")) return 100;

  const doneCount = activeSections.filter((s) => statuses[s.key] === "done").length;
  const genIdx    = activeSections.findIndex((s) => statuses[s.key] === "generating");
  let base = (doneCount / total) * 92;

  if (genIdx >= 0 && statusText) {
    const m = statusText.match(/(\d+)\s*[/of]+\s*(\d+)/);
    if (m) {
      const num = parseInt(m[1]!, 10);
      const tot = parseInt(m[2]!, 10);
      if (tot > 0) base += (num / tot) * (92 / total);
    } else {
      base += (1 / total) * 9.2;
    }
  }

  return Math.min(92, base);
}

// ── Confetti helper ───────────────────────────────────────────────────────────
// canvas-confetti's fillStyle can't resolve CSS custom properties (getComputedStyle
// never resolves a var() chain for a property read directly, only when applied to a
// real CSS property), so this stays a fixed palette rather than reading --brand/--text.
const CONFETTI_COLORS = ["var(--brand)", "var(--text)", "#FFD700", "#FFFFFF"];

function fireConfetti() {
  console.log("Celebration triggered");

  // Create a dedicated fixed canvas so confetti never causes layout shifts
  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:100%",
    "height:100%",
    "pointer-events:none",
    "z-index:9999",
  ].join(";");
  document.body.appendChild(canvas);

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });

  // First burst — left side
  requestAnimationFrame(() => {
    myConfetti({
      particleCount: 120,
      spread: 70,
      angle: 60,
      origin: { x: 0.2, y: 0.6 },
      colors: CONFETTI_COLORS,
    });
  });

  // Second burst — right side (150ms later)
  setTimeout(() => {
    requestAnimationFrame(() => {
      myConfetti({
        particleCount: 120,
        spread: 70,
        angle: 120,
        origin: { x: 0.8, y: 0.6 },
        colors: CONFETTI_COLORS,
      });
    });
  }, 150);

  // Follow-up centre burst for extra flair
  setTimeout(() => {
    requestAnimationFrame(() => {
      myConfetti({
        particleCount: 80,
        spread: 120,
        origin: { x: 0.5, y: 0.55 },
        colors: CONFETTI_COLORS,
      });
    });
  }, 600);

  // Clean up canvas after animation finishes (3.5s is plenty)
  setTimeout(() => {
    myConfetti.reset();
    canvas.remove();
  }, 3500);
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function LayahLogo() {
  return (
    <div className="flex items-center justify-center">
      <img src="/Logo.png" alt="Layah" className="h-10 w-auto" />
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
// This whole overlay is a deliberately inverted surface (bg-ink, text-inverse)
// so it always reads as a dark takeover regardless of the page's own light/dark
// theme — that flips correctly with .dark since --text/--text-inverse do.
function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand"
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
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-brand"
        aria-label="Generating"
      >
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
      </span>
    );
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-inverse/15"
      aria-label="Waiting"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LessonPlanLoadingGame({
  active,
  statusText,
  selectedSections,
  preset = "lesson-plan",
}: LessonPlanLoadingGameProps) {
  const sectionCatalog = sectionCatalogForPreset(preset);

  const activeSections =
    selectedSections && Object.values(selectedSections).some(Boolean)
      ? sectionCatalog.filter((s) => selectedSections[s.sectionKey] === true)
      : sectionCatalog;

  const copy =
    preset === "question-paper"
      ? {
          ariaLabel: "Generating your question paper",
          title: "Crafting your question paper",
          celebrateTitle: "Yaay! Your question paper is ready! 🎉",
          celebrateSub: "Taking you to your downloads…",
        }
      : {
          ariaLabel: "Generating your lesson plan",
          title: "Crafting your lesson package",
          celebrateTitle: "Yaay! Your lesson pack is ready! 🎉",
          celebrateSub: "Preparing your download…",
        };

  const [factIdx, setFactIdx]         = useState(0);
  const [factVisible, setFactVisible] = useState(true);
  const [statuses, setStatuses]       = useState<Record<string, SectionStatus>>(() =>
    emptyStatusesFor(sectionCatalog),
  );
  const [smoothProgress, setSmoothProgress] = useState(5);
  const [celebrating, setCelebrating] = useState(false);

  const targetProgressRef  = useRef(5);
  const stageFloorRef      = useRef(5);
  const rafRef             = useRef<number | null>(null);
  const celebratedRef      = useRef(false);

  // ── Reset on start ───────────────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      setStatuses(emptyStatusesFor(sectionCatalog));
      setSmoothProgress(5);
      targetProgressRef.current = 5;
      stageFloorRef.current = 5;
      celebratedRef.current = false;
      setCelebrating(false);
      setFactIdx(Math.floor(Math.random() * FUN_FACTS.length));
      setFactVisible(true);
    }
  }, [active]);

  // ── Rotate fun facts every 8 s with fade ────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setFactVisible(false);
      const t = setTimeout(() => {
        setFactIdx((i) => (i + 1) % FUN_FACTS.length);
        setFactVisible(true);
      }, 350);
      return () => clearTimeout(t);
    }, 8000);
    return () => clearInterval(id);
  }, [active]);

  // ── Parse statusText → checklist + celebration trigger ───────────────────
  useEffect(() => {
    if (!statusText || !active) return;

    // ── Celebration: fire as soon as "Finalizing" is received ────────────
    if (statusText.toLowerCase().includes("finaliz") && !celebratedRef.current) {
      celebratedRef.current = true;

      // Mark ALL active sections as done
      setStatuses((prev) => {
        const next = { ...prev };
        activeSections.forEach((s) => { next[s.key] = "done"; });
        return next;
      });

      // Push progress immediately to 100
      targetProgressRef.current = 100;
      stageFloorRef.current = 100;

      // Trigger confetti + celebration card
      fireConfetti();
      setCelebrating(true);
      return;
    }

    // ── Normal section tracking ──────────────────────────────────────────
    const found = detectActiveSection(statusText, activeSections);
    if (!found) return;

    const foundIdx = activeSections.findIndex((s) => s.key === found);
    if (foundIdx === -1) return;

    setStatuses((prev) => {
      const next = { ...prev };
      for (let i = 0; i < foundIdx; i++) {
        const k = activeSections[i]!.key;
        if (next[k] !== "done") next[k] = "done";
      }
      next[found] = "generating";
      for (let i = foundIdx + 1; i < activeSections.length; i++) {
        const k = activeSections[i]!.key;
        if (next[k] !== "done") next[k] = "waiting";
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusText, active]);

  // ── RAF smooth progress ──────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const tick = () => {
      const realTarget = computeProgress(statuses, statusText, activeSections);
      const target = Math.max(realTarget, stageFloorRef.current);
      targetProgressRef.current = target;
      setSmoothProgress((prev) => {
        const diff = targetProgressRef.current - prev;
        if (Math.abs(diff) < 0.1) return targetProgressRef.current;
        const factor = target >= 98 ? 0.18 : 0.1;
        return prev + diff * factor;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [active, statuses, statusText]);

  // ── Conservative staged floor ────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const STAGES = [
      { delay: 0,     floor: 8  },
      { delay: 600,   floor: 12 },
      { delay: 3000,  floor: 18 },
      { delay: 10000, floor: 25 },
      { delay: 25000, floor: 35 },
    ];
    const timers = STAGES.map(({ delay, floor }) =>
      setTimeout(() => {
        stageFloorRef.current = Math.max(stageFloorRef.current, floor);
        targetProgressRef.current = Math.max(targetProgressRef.current, floor);
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  const pct = Math.round(smoothProgress);
  const doneCount = activeSections.filter((s) => statuses[s.key] === "done").length;
  const currentLabel =
    activeSections.find((s) => statuses[s.key] === "generating")?.label ??
    (doneCount > 0 ? "Finishing up…" : "Starting generation…");

  /* ── Inline keyframes (no Framer Motion on loading screen) ───────────── */
  const keyframes = `
    @keyframes ldPulse {
      0%,100% { opacity:1; }
      50%      { opacity:0.6; }
    }
    @keyframes ldGlowRing {
      0%,100% { box-shadow:0 0 20px 4px color-mix(in oklch, var(--brand) 50%, transparent); }
      50%      { box-shadow:0 0 36px 10px color-mix(in oklch, var(--brand) 85%, transparent); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>

      {/* Full-screen overlay. bg-ink + text-inverse is a deliberately inverted
          surface — it reads as a dark takeover in light mode and a light one in
          dark mode, which is what keeps every text/border token below correctly
          legible in both themes instead of hardcoding one direction. */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink p-4"
        role="dialog"
        aria-modal="true"
        aria-label={copy.ariaLabel}
      >
        {/* ── Main loading card ───────────────────────────────────────────── */}
        {!celebrating && (
          <div className="w-full max-w-[460px] rounded-xl border border-brand-border/40 bg-ink p-7 shadow-overlay">
            <div className="mb-6 flex justify-center">
              <LayahLogo />
            </div>

            <p className="mb-1 text-center text-[17px] font-bold text-inverse">{copy.title}</p>
            <p className="mb-5 text-center text-[13px] text-inverse/60">{currentLabel}</p>

            <div className="mb-1.5 flex justify-between">
              <span className="text-xs font-semibold text-brand">Progress</span>
              <span className="text-xl font-extrabold text-inverse">{pct}%</span>
            </div>

            <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-inverse/15">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                style={{ width: `${smoothProgress}%` }}
              />
            </div>

            <div className="mb-6 flex flex-col gap-3">
              {activeSections.map((s) => {
                const status = statuses[s.key] ?? "waiting";
                const isActive = status === "generating";
                const isDone = status === "done";
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <StatusIcon status={status} />
                    <span
                      className={cn(
                        "flex-1 text-[15px]",
                        isActive ? "font-bold" : "font-normal",
                        isDone ? "text-inverse/50 line-through" : "text-inverse",
                      )}
                    >
                      {s.label}
                    </span>
                    {isActive && (
                      <span className="animate-[ldPulse_1.2s_ease_infinite] text-xs font-semibold text-brand">
                        Generating…
                      </span>
                    )}
                    {isDone && <span className="text-xs font-semibold text-brand">Done ✓</span>}
                    {status === "waiting" && <span className="text-xs text-inverse/35">Waiting</span>}
                  </div>
                );
              })}
            </div>

            <div className="mb-4 h-px bg-inverse/10" />

            <div className="flex items-start gap-2.5">
              <span className="shrink-0 text-base" aria-hidden>
                💡
              </span>
              <p className="text-[13px] leading-relaxed text-inverse/70">
                <span className="font-bold text-inverse">Did you know?&nbsp;</span>
                {FUN_FACTS[factIdx]}
              </p>
            </div>
          </div>
        )}

        {/* ── Celebration card ────────────────────────────────────────────── */}
        {celebrating && (
          <div className="w-[90%] max-w-[400px] rounded-xl border-2 border-brand-border bg-surface-raised px-9 py-10 text-center shadow-overlay">
            <div
              className="mx-auto mb-5 flex size-[88px] items-center justify-center rounded-full bg-brand"
              style={{ animation: "ldGlowRing 1.4s ease-in-out infinite" }}
            >
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M8 22l9 9 19-18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <p className="mb-2 text-2xl font-extrabold text-ink">{copy.celebrateTitle}</p>
            <p className="text-sm text-muted">{copy.celebrateSub}</p>
          </div>
        )}
      </div>
    </>
  );
}
