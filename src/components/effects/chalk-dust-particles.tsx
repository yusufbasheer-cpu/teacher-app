"use client";

import { useEffect, useRef } from "react";

const MAX_PARTICLES = 30;
const SPAWN_INTERVAL_MS = 420;

type Particle = {
  x: number;
  y: number;
  size: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  color: string;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function ChalkDustParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const particles: Particle[] = [];
    let raf = 0;
    let lastSpawn = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      if (particles.length >= MAX_PARTICLES) return;
      particles.push({
        x: randomBetween(0, window.innerWidth),
        y: randomBetween(window.innerHeight * 0.55, window.innerHeight + 40),
        size: randomBetween(1, 3.2),
        vy: randomBetween(0.15, 0.55),
        vx: randomBetween(-0.12, 0.12),
        life: 0,
        maxLife: randomBetween(2800, 5200),
        color: Math.random() > 0.45 ? "rgba(255,255,255,0.35)" : "rgba(0,198,167,0.28)",
      });
    };

    const tick = (now: number) => {
      if (!running) return;
      if (document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (now - lastSpawn > SPAWN_INTERVAL_MS && particles.length < MAX_PARTICLES) {
        spawn();
        lastSpawn = now;
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.life += 16;
        p.x += p.vx;
        p.y -= p.vy;
        const t = p.life / p.maxLife;
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        if (t >= 1) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, alpha * 0.9);
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    const onVis = () => {
      if (!document.hidden) lastSpawn = 0;
    };
    document.addEventListener("visibilitychange", onVis);

    for (let i = 0; i < 12; i++) spawn();
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[2]"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
