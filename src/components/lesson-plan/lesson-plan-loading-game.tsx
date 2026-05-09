"use client";

import { useEffect, useRef, useState } from "react";

type ObstacleType = "book" | "pencil" | "bag";

type Obstacle = {
  id: number;
  x: number;
  type: ObstacleType;
  w: number;
  h: number;
  passed: boolean;
  hit: boolean;
};

type LessonPlanLoadingGameProps = {
  /** While true, the game runs; when false, unmounts (AI finished or errored). */
  active: boolean;
};

const OB_TYPES: ObstacleType[] = ["book", "pencil", "bag"];

function drawPixelTeacher(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flash: boolean,
) {
  const px = (n: number) => Math.round(x + (n * w) / 44);
  const py = (n: number) => Math.round(y + (n * h) / 56);

  const skin = flash ? "#fecdd3" : "#fcd9b6";
  const shirt = "#2563eb";
  const pants = "#1e293b";
  const cap = "#1e3a8a";
  const capBand = "#172554";

  // Mortarboard (top)
  ctx.fillStyle = cap;
  ctx.fillRect(px(4), py(0), Math.round((36 * w) / 44), Math.round((10 * h) / 56));
  ctx.fillStyle = capBand;
  ctx.fillRect(px(6), py(8), Math.round((32 * w) / 44), Math.round((4 * h) / 56));
  // Tassel
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(px(34), py(6), Math.round((4 * w) / 44), Math.round((14 * h) / 56));

  // Head
  ctx.fillStyle = skin;
  ctx.fillRect(px(10), py(10), Math.round((24 * w) / 44), Math.round((18 * h) / 56));

  // Body / shirt
  ctx.fillStyle = shirt;
  ctx.fillRect(px(8), py(26), Math.round((28 * w) / 44), Math.round((22 * h) / 56));
  // Simple tie
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(px(20), py(30), Math.round((6 * w) / 44), Math.round((16 * h) / 56));

  // Legs
  ctx.fillStyle = pants;
  ctx.fillRect(px(10), py(46), Math.round((10 * w) / 44), Math.round((10 * h) / 56));
  ctx.fillRect(px(24), py(46), Math.round((10 * w) / 44), Math.round((10 * h) / 56));

  // Eyes (pixel)
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(px(14), py(16), Math.round((4 * w) / 44), Math.round((4 * h) / 56));
  ctx.fillRect(px(26), py(16), Math.round((4 * w) / 44), Math.round((4 * h) / 56));
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  groundTop: number,
) {
  const y = groundTop - obs.h;
  if (obs.type === "book") {
    ctx.fillStyle = "#92400e";
    ctx.fillRect(obs.x, y, obs.w, obs.h);
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(obs.x + 4, y + 4, obs.w - 8, obs.h - 10);
    ctx.fillStyle = "#451a03";
    ctx.fillRect(obs.x + 6, y + obs.h - 8, obs.w - 12, 4);
  } else if (obs.type === "pencil") {
    ctx.fillStyle = "#facc15";
    ctx.fillRect(obs.x + 6, y, 8, obs.h - 10);
    ctx.fillStyle = "#fca5a5";
    ctx.fillRect(obs.x + 4, y, 12, 8);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(obs.x + 6, y + obs.h - 10, 8, 10);
  } else {
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(obs.x, y + 8, obs.w, obs.h - 8);
    ctx.fillStyle = "#172554";
    ctx.fillRect(obs.x + 8, y, obs.w - 16, 14);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(obs.x + obs.w - 14, y + 12, 8, 6);
  }
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function LessonPlanLoadingGame({ active }: LessonPlanLoadingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const flashRef = useRef(0);
  const displayedFloorRef = useRef(0);

  activeRef.current = active;

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const cssW = 600;
    const cssH = 220;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    let spawnNext = performance.now() + 900;
    let idCounter = 0;
    const obstacles: Obstacle[] = [];

    scoreRef.current = 0;
    displayedFloorRef.current = 0;
    setScore(0);

    const bumpScoreUi = () => {
      const floor = Math.floor(scoreRef.current);
      if (floor !== displayedFloorRef.current) {
        displayedFloorRef.current = floor;
        setScore(floor);
      }
    };

    const groundY = cssH - 36;
    const teacher = { x: 72, y: groundY - 56, w: 44, h: 56, vy: 0, onGround: true };

    const jump = () => {
      if (teacher.onGround) {
        teacher.vy = -560;
        teacher.onGround = false;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      jump();
    };
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("mousedown", jump);

    const spawnObstacle = () => {
      const type = OB_TYPES[Math.floor(Math.random() * OB_TYPES.length)]!;
      let w = 36;
      let h = 40;
      if (type === "pencil") {
        w = 22;
        h = 44;
      } else if (type === "bag") {
        w = 40;
        h = 44;
      }
      obstacles.push({
        id: ++idCounter,
        x: cssW + 8,
        type,
        w,
        h,
        passed: false,
        hit: false,
      });
    };

    const loop = (t: number) => {
      if (!activeRef.current) return;

      const dt = Math.min((t - last) / 1000, 0.045);
      last = t;

      // Physics
      teacher.vy += 1750 * dt;
      teacher.y += teacher.vy * dt;
      if (teacher.y >= groundY - teacher.h) {
        teacher.y = groundY - teacher.h;
        teacher.vy = 0;
        teacher.onGround = true;
      }

      // Spawn
      if (t >= spawnNext) {
        spawnObstacle();
        spawnNext = t + 1100 + Math.random() * 900;
      }

      const speed = 260 + Math.min(scoreRef.current * 0.35, 140);

      for (const o of obstacles) {
        o.x -= speed * dt;
        if (!o.passed && o.x + o.w < teacher.x) {
          o.passed = true;
          scoreRef.current += 12;
          bumpScoreUi();
        }
        if (
          !o.hit &&
          rectsOverlap(teacher.x + 6, teacher.y + 8, teacher.w - 12, teacher.h - 10, o.x, groundY - o.h, o.w, o.h)
        ) {
          o.hit = true;
          scoreRef.current = Math.max(0, scoreRef.current - 8);
          bumpScoreUi();
          flashRef.current = 8;
        }
      }

      while (obstacles.length && obstacles[0]!.x + obstacles[0]!.w < -20) {
        obstacles.shift();
      }

      scoreRef.current += dt * 6;
      bumpScoreUi();
      if (flashRef.current > 0) flashRef.current -= 1;

      // Draw
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(0, 0, cssW, cssH);
      // Ground
      ctx.fillStyle = "#bfdbfe";
      ctx.fillRect(0, groundY, cssW, cssH - groundY);
      ctx.strokeStyle = "#93c5fd";
      ctx.beginPath();
      ctx.moveTo(0, groundY + 0.5);
      ctx.lineTo(cssW, groundY + 0.5);
      ctx.stroke();

      for (const o of obstacles) {
        drawObstacle(ctx, o, groundY);
      }

      drawPixelTeacher(ctx, teacher.x, teacher.y, teacher.w, teacher.h, flashRef.current > 0);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("mousedown", jump);
      document.body.style.overflow = "";
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Lesson plan loading mini game"
    >
      <div className="w-full max-w-lg rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
          <p className="text-2xl font-bold tabular-nums text-blue-700">{score}</p>
        </div>
        <p className="mb-3 text-center text-sm font-semibold leading-snug text-blue-900">
          Your lesson plan is being prepared… keep the teacher running!
        </p>
        <div className="flex justify-center rounded-xl border border-blue-100 bg-sky-50 p-2">
          <canvas
            ref={canvasRef}
            className="max-w-full cursor-pointer touch-manipulation rounded-lg"
            aria-label="Jump game canvas"
          />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          Space or tap / click to jump · Dodge books, pencils &amp; school bags
        </p>
      </div>
    </div>
  );
}
