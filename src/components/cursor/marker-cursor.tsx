"use client";

import { useEffect, useRef, useState } from "react";

const TEAL = "#00C6A7";
const TRAIL_MS = 500;
const MAX_POINTS = 28;
const MIN_DIST = 5;

type TrailPoint = { x: number; y: number; t: number };

function isClickableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'a[href], button, [role="button"], input[type="button"], input[type="submit"], label[for], select, summary, [data-cursor-hover="true"]',
    ),
  );
}

function MarkerIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="32"
      viewBox="0 0 26 32"
      fill="none"
      aria-hidden
      className="drop-shadow-sm transition-transform duration-150"
      style={{
        transform: active ? "rotate(-18deg) scale(1.12)" : "rotate(-24deg) scale(1)",
        filter: active ? "drop-shadow(0 0 6px rgba(0,198,167,0.65))" : undefined,
      }}
    >
      <path
        d="M6 28L4 30L7 29.5L8.5 27L20 4.5C20.8 2.8 22.5 2 24 3.2C25.4 4.3 25.2 6.2 23.8 7.5L6 28Z"
        fill={TEAL}
        stroke="#0A1628"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M20 4.5L23.5 7.5" stroke="#0A1628" strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="22.5" cy="5.2" rx="2.2" ry="1.4" fill="#E8FFF9" opacity="0.9" />
      <path d="M5 27.5L8 26" stroke="#007a66" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function MarkerCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [onPage, setOnPage] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<TrailPoint[]>([]);
  const rafRef = useRef(0);
  const drawingRef = useRef(false);
  const posRef = useRef({ x: 0, y: 0 });
  const dprRef = useRef(1);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => {
      const on = mq.matches;
      setEnabled(on);
      document.documentElement.classList.toggle("layah-custom-cursor", on);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.classList.remove("layah-custom-cursor");
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();

    const draw = (now: number) => {
      pointsRef.current = pointsRef.current.filter((p) => now - p.t < TRAIL_MS);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pts = pointsRef.current;
      const dpr = dprRef.current;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        const age = (now - p.t) / TRAIL_MS;
        const alpha = Math.max(0, 1 - age);
        const radius = (1.5 + (1 - age) * 2) * dpr;

        ctx.beginPath();
        ctx.arc(p.x * dpr, p.y * dpr, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 198, 167, ${alpha * 0.5})`;
        ctx.fill();

        if (i > 0) {
          const prev = pts[i - 1]!;
          const agePrev = (now - prev.t) / TRAIL_MS;
          const lineAlpha = Math.max(0, 1 - (age + agePrev) / 2) * 0.35;
          ctx.beginPath();
          ctx.moveTo(prev.x * dpr, prev.y * dpr);
          ctx.lineTo(p.x * dpr, p.y * dpr);
          ctx.strokeStyle = `rgba(0, 198, 167, ${lineAlpha})`;
          ctx.lineWidth = 1.25 * dpr;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      if (pts.length > 0) {
        rafRef.current = requestAnimationFrame(draw);
        drawingRef.current = true;
      } else {
        drawingRef.current = false;
      }
    };

    const scheduleDraw = () => {
      if (!drawingRef.current) {
        drawingRef.current = true;
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    const moveCursor = (x: number, y: number) => {
      posRef.current = { x, y };
      const el = cursorRef.current;
      if (el) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    };

    const addPoint = (x: number, y: number) => {
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return;
      }
      pts.push({ x, y, t: performance.now() });
      if (pts.length > MAX_POINTS) pts.shift();
      scheduleDraw();
    };

    const onMove = (e: MouseEvent) => {
      moveCursor(e.clientX, e.clientY);
      addPoint(e.clientX, e.clientY);
    };

    const onEnter = () => setOnPage(true);
    const onLeave = () => {
      setOnPage(false);
      pointsRef.current = [];
    };

    const onOver = (e: MouseEvent) => {
      setHovering(isClickableTarget(e.target));
    };

    const onVisibility = () => {
      if (document.hidden) {
        pointsRef.current = [];
        cancelAnimationFrame(rafRef.current);
        drawingRef.current = false;
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(rafRef.current);
      drawingRef.current = false;
      pointsRef.current = [];
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9998]"
      />
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[9999] will-change-transform"
        style={{
          marginLeft: 4,
          marginTop: -2,
          opacity: onPage ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      >
        <MarkerIcon active={hovering} />
      </div>
    </>
  );
}
