"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

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
const CONFETTI_COLORS = ["#0E9484", "#241A12", "#FFD700", "#FFFFFF"];

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
      <img
        src="/Logo.png"
        alt="Layah"
        height={40}
        className="h-10 w-auto"
        style={{ height: 40, width: "auto" }}
      />
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "done") {
    return (
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "#0E9484" }}
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
        style={{ borderColor: "#0E9484" }}
        aria-label="Generating"
      >
        <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#0E9484" }} />
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
      0%,100% { box-shadow:0 0 20px 4px rgba(14, 148, 132,0.5); }
      50%      { box-shadow:0 0 36px 10px rgba(14, 148, 132,0.85); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>

      {/* Full-screen overlay — explicit top/left/width/height so no
          ancestor containing-block quirk can shrink or offset it */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          backgroundColor: "#241A12",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={copy.ariaLabel}
      >
        {/* ── Main loading card ───────────────────────────────────────────── */}
        {!celebrating && (
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#3a2a1e",
              border: "1px solid rgba(14, 148, 132,0.4)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <LayahLogo />
            </div>

            {/* Title */}
            <p style={{ textAlign: "center", fontSize: 17, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
              {copy.title}
            </p>
            <p style={{ textAlign: "center", fontSize: 13, color: "#a79a87", marginBottom: 20 }}>
              {currentLabel}
            </p>

            {/* Progress bar label */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0E9484" }}>Progress</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#FFFFFF" }}>{pct}%</span>
            </div>

            {/* Progress bar track */}
            <div
              style={{
                width: "100%",
                height: 10,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 99,
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${smoothProgress}%`,
                  background: "linear-gradient(90deg,#0E9484,#00e8c3)",
                  borderRadius: 99,
                  boxShadow: "0 0 10px rgba(14, 148, 132,0.7)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>

            {/* Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {activeSections.map((s) => {
                const status = statuses[s.key] ?? "waiting";
                const isActive  = status === "generating";
                const isDone    = status === "done";
                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusIcon status={status} />
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: isActive ? 700 : 400,
                        color: isDone ? "rgba(255,255,255,0.5)" : "#FFFFFF",
                        textDecoration: isDone ? "line-through" : "none",
                        flex: 1,
                      }}
                    >
                      {s.label}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0E9484", animation: "ldPulse 1.2s ease infinite" }}>
                        Generating…
                      </span>
                    )}
                    {isDone && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0E9484" }}>Done ✓</span>
                    )}
                    {status === "waiting" && (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Waiting</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 16 }} />

            {/* Fun fact */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden>💡</span>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#E3D9C8", margin: 0 }}>
                <span style={{ fontWeight: 700, color: "#FFFFFF" }}>Did you know?&nbsp;</span>
                {FUN_FACTS[factIdx]}
              </p>
            </div>
          </div>
        )}

        {/* ── Celebration card ────────────────────────────────────────────── */}
        {celebrating && (
          <div
            style={{
              width: "90%",
              maxWidth: 400,
              backgroundColor: "#FFFCF7",
              borderRadius: 24,
              padding: "40px 36px",
              textAlign: "center",
              border: "2px solid rgba(14, 148, 132,0.5)",
              boxShadow: "0 0 60px 16px rgba(14, 148, 132,0.35), 0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Glowing checkmark */}
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                backgroundColor: "#0E9484",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                animation: "ldGlowRing 1.4s ease-in-out infinite",
              }}
            >
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M8 22l9 9 19-18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <p style={{ fontSize: 22, fontWeight: 800, color: "#241A12", marginBottom: 8 }}>
              {copy.celebrateTitle}
            </p>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              {copy.celebrateSub}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
