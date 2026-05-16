"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

// ── Types ─────────────────────────────────────────────────────────────────────
type LessonPlanLoadingGameProps = {
  active: boolean;
  statusText?: string | null;
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

// ── Section checklist ─────────────────────────────────────────────────────────
type SectionStatus = "waiting" | "generating" | "done";

const SECTIONS: { key: string; sectionKey: string; label: string; keywords: string[] }[] = [
  { key: "lesson",     sectionKey: "Full Lesson Plan",     label: "Lesson Plan",         keywords: ["lesson plan", "full lesson", "lesson content"] },
  { key: "ppt",        sectionKey: "PPT Slide Content",    label: "PPT Content",          keywords: ["ppt", "slide", "presentation", "deck"] },
  { key: "worksheet",  sectionKey: "Worksheet",            label: "Worksheet",            keywords: ["worksheet"] },
  { key: "assessment", sectionKey: "Assessment Questions", label: "Assessment Questions", keywords: ["assessment", "quiz", "question"] },
  { key: "homework",   sectionKey: "Homework Task",        label: "Homework Task",        keywords: ["homework", "home task", "extended task"] },
  { key: "notes",      sectionKey: "Teacher Notes",        label: "Teacher Notes",        keywords: ["teacher note", "notes"] },
  { key: "afl",        sectionKey: "AFL Activity Sheets",  label: "AFL Activity Sheets",  keywords: ["afl", "activity sheet", "printable"] },
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
const CONFETTI_COLORS = ["#00C6A7", "#0A1628", "#FFD700", "#FFFFFF"];

function fireConfetti() {
  console.log("Celebration triggered");

  // Main burst from center
  confetti({
    particleCount: 200,
    spread: 160,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS,
  });

  // Left side burst
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { x: 0.1, y: 0.5 },
      angle: 60,
      colors: CONFETTI_COLORS,
    });
  }, 250);

  // Right side burst
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { x: 0.9, y: 0.5 },
      angle: 120,
      colors: CONFETTI_COLORS,
    });
  }, 250);

  // Follow-up bursts
  setTimeout(() => {
    confetti({ particleCount: 80, spread: 120, origin: { y: 0.55 }, colors: CONFETTI_COLORS });
  }, 700);
  setTimeout(() => {
    confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, colors: CONFETTI_COLORS });
  }, 1400);
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function LayahLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: "#00C6A7" }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M11 3L4 8v10h5v-5h4v5h5V8L11 3z" fill="white" opacity="0.95" />
        </svg>
      </div>
      <span className="text-xl font-bold tracking-tight text-white">
        Layah<span style={{ color: "#00C6A7" }}>.ai</span>
      </span>
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
        <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#00C6A7" }} />
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
  const activeSections =
    selectedSections && Object.values(selectedSections).some(Boolean)
      ? SECTIONS.filter((s) => selectedSections[s.sectionKey] === true)
      : SECTIONS;

  const [factIdx, setFactIdx]         = useState(0);
  const [factVisible, setFactVisible] = useState(true);
  const [statuses, setStatuses]       = useState<Record<string, SectionStatus>>(emptyStatuses());
  const [smoothProgress, setSmoothProgress] = useState(5);
  const [celebrating, setCelebrating] = useState(false);

  const targetProgressRef = useRef(5);
  const stageFloorRef     = useRef(5);
  const rafRef            = useRef<number | null>(null);
  const celebratedRef     = useRef(false);

  // ── Reset on start ───────────────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      setStatuses(emptyStatuses());
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
    const found = detectActiveSection(statusText);
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

  return (
    <>
      {/* ── CSS keyframes ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes celebFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 24px 6px rgba(0,198,167,0.55), 0 0 60px 12px rgba(0,198,167,0.25); transform: scale(1); }
          50%       { box-shadow: 0 0 40px 12px rgba(0,198,167,0.8), 0 0 90px 24px rgba(0,198,167,0.4); transform: scale(1.08); }
        }
        @keyframes textGlow {
          0%, 100% { text-shadow: 0 0 12px rgba(0,198,167,0.6), 0 0 28px rgba(0,198,167,0.3); }
          50%       { text-shadow: 0 0 24px rgba(0,198,167,1),   0 0 56px rgba(0,198,167,0.6); }
        }
      `}</style>

      {/* ── Background overlay ────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(10,22,40,0.96)", backdropFilter: "blur(4px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Generating your lesson plan"
      >
        {/* ── Normal loading card ─────────────────────────────────────────── */}
        <div
          className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(0,198,167,0.18)",
            opacity: celebrating ? 0 : 1,
            transition: "opacity 0.4s ease",
            pointerEvents: celebrating ? "none" : "auto",
          }}
        >
          <div className="mb-6 flex justify-center">
            <LayahLogo />
          </div>

          <p className="mb-1 text-center text-base font-semibold text-white">
            Crafting your lesson package
          </p>
          <p className="mb-5 text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            {currentLabel}
          </p>

          {/* Progress bar */}
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "#00C6A7" }}>Progress</span>
            <span className="text-xs font-bold tabular-nums text-white">{pct}%</span>
          </div>
          <div
            className="mb-6 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${smoothProgress}%`, background: "linear-gradient(90deg,#00C6A7,#00e8c3)" }}
            />
          </div>

          {/* Checklist */}
          <div className="mb-6 space-y-2.5">
            {activeSections.map((s) => {
              const status = statuses[s.key] ?? "waiting";
              const isActive = status === "generating";
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <StatusIcon status={status} />
                  <span
                    className={`text-sm transition-colors duration-300 ${status === "done" ? "line-through" : isActive ? "font-semibold text-white" : ""}`}
                    style={{ color: status === "done" ? "rgba(255,255,255,0.35)" : isActive ? "#ffffff" : "rgba(255,255,255,0.5)" }}
                  >
                    {s.label}
                  </span>
                  {isActive  && <span className="ml-auto text-xs font-medium" style={{ color: "#00C6A7" }}>Generating…</span>}
                  {status === "done"    && <span className="ml-auto text-xs font-medium" style={{ color: "#00C6A7" }}>Done</span>}
                  {status === "waiting" && <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Waiting</span>}
                </div>
              );
            })}
          </div>

          <div className="mb-4 h-px w-full" style={{ background: "rgba(255,255,255,0.07)" }} />

          {/* Fun fact */}
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-shrink-0 text-base" aria-hidden>💡</span>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "rgba(255,255,255,0.45)", opacity: factVisible ? 1 : 0, transition: "opacity 0.35s ease" }}
            >
              <span className="font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>Did you know?&nbsp;</span>
              {FUN_FACTS[factIdx]}
            </p>
          </div>
        </div>

        {/* ── Celebration card — rendered AFTER the loading card so it sits on top ── */}
        {celebrating && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 10 }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 24,
                padding: "40px 48px",
                textAlign: "center",
                maxWidth: 400,
                width: "90%",
                border: "2px solid rgba(0,198,167,0.4)",
                boxShadow: "0 0 60px 16px rgba(0,198,167,0.35), 0 8px 40px rgba(0,0,0,0.4)",
                animation: "celebFadeIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards",
              }}
            >
              {/* Glowing checkmark */}
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "#00C6A7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  animation: "glowPulse 1.4s ease-in-out infinite",
                }}
              >
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <path d="M8 22l9 9 19-18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Message */}
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0A1628",
                  marginBottom: 8,
                  animation: "textGlow 1.6s ease-in-out infinite",
                }}
              >
                Yaay! Your lesson pack is ready! 🎉
              </p>
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                Preparing your download…
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
