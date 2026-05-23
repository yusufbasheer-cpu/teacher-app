"use client";

import type { ReactNode } from "react";

type AnimatedHeroGradientProps = {
  children: ReactNode;
  className?: string;
  /** Light grid overlay (landing-style) */
  showGrid?: boolean;
};

export function AnimatedHeroGradient({
  children,
  className = "",
  showGrid = false,
}: AnimatedHeroGradientProps) {
  return (
    <section className={`layah-hero-section relative overflow-hidden ${className}`}>
      <div className="layah-hero-gradient-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="layah-hero-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="layah-hero-aurora layah-hero-aurora--alt pointer-events-none absolute inset-0" aria-hidden />

      {showGrid ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#00C6A7 1px, transparent 1px), linear-gradient(90deg, #00C6A7 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />
      ) : null}

      <div className="relative z-10">{children}</div>
    </section>
  );
}
