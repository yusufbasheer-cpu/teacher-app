"use client";

import { formatEtaClock } from "@/lib/lesson-plan";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

export type QpGenStepStatus = "idle" | "running" | "done" | "error" | "skipped";

export type QpGenProgress = {
  paper: QpGenStepStatus;
  blueprint: QpGenStepStatus;
  downloads: QpGenStepStatus;
};

type QuestionPaperLoadingGameProps = {
  active: boolean;
  includeBlueprint: boolean;
  progress: QpGenProgress;
  estimatedSeconds: number;
};

type StepStatus = "waiting" | "generating" | "done" | "error";

const FUN_FACTS = [
  "The word 'school' comes from the Greek word 'skholē' meaning leisure.",
  "The first pencil was made in England in 1565.",
  "Albert Einstein failed his first university entrance exam.",
  "Honey never expires — archaeologists found 3,000-year-old honey in Egyptian tombs.",
  "A group of flamingos is called a flamboyance.",
  "The first computer bug was an actual bug — a moth found inside a computer in 1947.",
  "Bananas are technically berries, but strawberries are not.",
  "The human brain generates enough electricity to power a small light bulb.",
  "Sharks are older than trees — they have existed for over 400 million years.",
  "It takes 8 minutes and 20 seconds for light to travel from the sun to Earth.",
];

const CONFETTI_COLORS = ["#00C6A7", "#0A1628", "#FFD700", "#FFFFFF"];

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:100%",
    "height:100%",
    "pointer-events:none",
    "z-index:99999",
  ].join(";");
  document.body.appendChild(canvas);

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });
  requestAnimationFrame(() => {
    myConfetti({ particleCount: 100, spread: 70, angle: 60, origin: { x: 0.2, y: 0.6 }, colors: CONFETTI_COLORS });
  });
  setTimeout(() => {
    requestAnimationFrame(() => {
      myConfetti({ particleCount: 100, spread: 70, angle: 120, origin: { x: 0.8, y: 0.6 }, colors: CONFETTI_COLORS });
    });
  }, 150);
  setTimeout(() => {
    requestAnimationFrame(() => {
      myConfetti({ particleCount: 70, spread: 120, origin: { x: 0.5, y: 0.55 }, colors: CONFETTI_COLORS });
    });
  }, 600);
  setTimeout(() => {
    myConfetti.reset();
    canvas.remove();
  }, 3500);
}

function fmtTime(secs: number): string {
  return formatEtaClock(Math.max(0, secs));
}

function mapStep(s: QpGenStepStatus): StepStatus {
  if (s === "running") return "generating";
  if (s === "done" || s === "skipped") return "done";
  if (s === "error") return "error";
  return "waiting";
}

function computeTargetProgress(progress: QpGenProgress, includeBlueprint: boolean): number {
  if (progress.downloads === "done") return 100;
  if (progress.downloads === "running") return includeBlueprint ? 88 : 92;

  if (includeBlueprint) {
    if (progress.blueprint === "running") return 55;
    if (progress.blueprint === "done" || progress.blueprint === "error") return 72;
    if (progress.paper === "done") return 42;
    if (progress.paper === "running") return 22;
    return 8;
  }

  if (progress.paper === "done") return 70;
  if (progress.paper === "running") return 35;
  return 8;
}

function LayahLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#00C6A7" }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M11 3L4 8v10h5v-5h4v5h5V8L11 3z" fill="white" opacity="0.95" />
        </svg>
      </div>
      <span className="font-layah-logo text-xl font-bold tracking-tight text-white">
        Layah<span style={{ color: "#00C6A7" }}>.ai</span>
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
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
  if (status === "error") {
    return (
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: "#ef4444" }}
        aria-label="Failed"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M3 3l5 5M8 3l-5 5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
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
        <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#00C6A7" }} />
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

const CHECKLIST = [
  { key: "paper" as const, label: "Generating Question Paper…" },
  { key: "blueprint" as const, label: "Generating Blueprint…", optional: true },
  { key: "downloads" as const, label: "Preparing Downloads…" },
];

export function QuestionPaperLoadingGame({
  active,
  includeBlueprint,
  progress,
  estimatedSeconds,
}: QuestionPaperLoadingGameProps) {
  const estimatedTotal = Math.max(25, estimatedSeconds);

  const [factIdx, setFactIdx] = useState(0);
  const [factVisible, setFactVisible] = useState(true);
  const [smoothProgress, setSmoothProgress] = useState(5);
  const [celebrating, setCelebrating] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const targetProgressRef = useRef(5);
  const stageFloorRef = useRef(5);
  const rafRef = useRef<number | null>(null);
  const celebratedRef = useRef(false);

  const activeSteps = CHECKLIST.filter((s) => !s.optional || includeBlueprint);

  const currentLabel =
    progress.paper === "running"
      ? "Writing your question paper…"
      : includeBlueprint && progress.blueprint === "running"
        ? "Building examination blueprint…"
        : progress.downloads === "running"
          ? "Preparing your downloads…"
          : progress.paper === "done"
            ? "Almost ready…"
            : "Starting generation…";

  useEffect(() => {
    if (active) {
      setSmoothProgress(5);
      targetProgressRef.current = 5;
      stageFloorRef.current = 5;
      celebratedRef.current = false;
      setCelebrating(false);
      setElapsedSecs(0);
      setFactIdx(Math.floor(Math.random() * FUN_FACTS.length));
      setFactVisible(true);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setElapsedSecs((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setFactIdx((i) => (i + 1) % FUN_FACTS.length);
        setFactVisible(true);
      }, 350);
    }, 8000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || celebratedRef.current) return;
    if (progress.downloads === "done") {
      celebratedRef.current = true;
      targetProgressRef.current = 100;
      stageFloorRef.current = 100;
      fireConfetti();
      setCelebrating(true);
    }
  }, [active, progress.downloads]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const target = Math.max(computeTargetProgress(progress, includeBlueprint), stageFloorRef.current);
      targetProgressRef.current = target;
      setSmoothProgress((prev) => {
        const diff = targetProgressRef.current - prev;
        if (Math.abs(diff) < 0.1) return targetProgressRef.current;
        return prev + diff * (target >= 98 ? 0.18 : 0.1);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, progress, includeBlueprint]);

  useEffect(() => {
    if (!active) return;
    const timers = [
      setTimeout(() => { stageFloorRef.current = Math.max(stageFloorRef.current, 10); }, 0),
      setTimeout(() => { stageFloorRef.current = Math.max(stageFloorRef.current, 18); }, 3000),
      setTimeout(() => { stageFloorRef.current = Math.max(stageFloorRef.current, 28); }, 12000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  const pct = Math.round(smoothProgress);
  const remaining = Math.max(0, estimatedTotal - elapsedSecs);
  const isOverrun = !celebrating && remaining === 0;

  const keyframes = `
    @keyframes qpLdPulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
    @keyframes qpLdGlowRing {
      0%,100% { box-shadow:0 0 20px 4px rgba(0,198,167,0.5); }
      50% { box-shadow:0 0 36px 10px rgba(0,198,167,0.85); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
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
          backgroundColor: "#0A1628",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Generating your question paper"
      >
        {!celebrating ? (
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              backgroundColor: "#112240",
              border: "1px solid rgba(0,198,167,0.4)",
              borderRadius: 20,
              padding: 28,
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <LayahLogo />
            </div>

            <p style={{ textAlign: "center", fontSize: 17, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
              Crafting your question paper
            </p>
            <p style={{ textAlign: "center", fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>{currentLabel}</p>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00C6A7" }}>Progress</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#FFFFFF" }}>{pct}%</span>
            </div>

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
                  background: "linear-gradient(90deg,#00C6A7,#00e8c3)",
                  borderRadius: 99,
                  boxShadow: "0 0 10px rgba(0,198,167,0.7)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>

            <div
              style={{
                marginBottom: 20,
                borderRadius: 12,
                background: "rgba(0,198,167,0.07)",
                border: "1px solid rgba(0,198,167,0.2)",
                padding: "14px 16px",
              }}
            >
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                Estimated time:{" "}
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{fmtTime(estimatedTotal)}</span>
              </p>
              {isOverrun ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, animation: "qpLdPulse 1.2s ease infinite" }}>⏳</span>
                  <span style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>Almost there…</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Time remaining:</span>
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: "#00C6A7",
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "-1px",
                      lineHeight: 1,
                    }}
                  >
                    {fmtTime(remaining)}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {activeSteps.map((s) => {
                const raw = progress[s.key];
                const status = mapStep(raw);
                const isActive = status === "generating";
                const isDone = status === "done";
                const isError = status === "error";
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
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#00C6A7", animation: "qpLdPulse 1.2s ease infinite" }}>
                        Generating…
                      </span>
                    )}
                    {isDone && !isError && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#00C6A7" }}>Done ✓</span>
                    )}
                    {isError && <span style={{ fontSize: 12, fontWeight: 600, color: "#f87171" }}>Skipped</span>}
                    {status === "waiting" && (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Waiting</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 16 }} />

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: factVisible ? 1 : 0, transition: "opacity 0.35s ease" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }} aria-hidden>
                💡
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#E2E8F0", margin: 0 }}>
                <span style={{ fontWeight: 700, color: "#FFFFFF" }}>Did you know?&nbsp;</span>
                {FUN_FACTS[factIdx]}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              width: "90%",
              maxWidth: 400,
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: "40px 36px",
              textAlign: "center",
              border: "2px solid rgba(0,198,167,0.5)",
              boxShadow: "0 0 60px 16px rgba(0,198,167,0.35), 0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                backgroundColor: "#00C6A7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                animation: "qpLdGlowRing 1.4s ease-in-out infinite",
              }}
            >
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M8 22l9 9 19-18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#0A1628", marginBottom: 8 }}>
              Your question paper is ready! 🎉
            </p>
            <p style={{ fontSize: 14, color: "#6b7280" }}>Taking you to your downloads…</p>
          </div>
        )}
      </div>
    </>
  );
}
