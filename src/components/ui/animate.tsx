"use client";

/**
 * Layah.ai — reusable animation primitives built on Framer Motion.
 *
 * Exports:
 *  - PageTransition     — wraps an entire page in a fade + slide-up entry
 *  - FadeIn             — fade + slide-up when an element enters the viewport
 *  - StaggerChildren    — stagger-wraps direct children with fade-up animations
 *  - Skeleton           — shimmer placeholder for loading states
 */

import { motion, AnimatePresence, animate } from "framer-motion";
import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, HTMLAttributes } from "react";

// ── Shared easing ─────────────────────────────────────────────────────────────
const EASE_OUT = [0.0, 0.0, 0.2, 1] as const;

// ── PageTransition ────────────────────────────────────────────────────────────
/**
 * Wrap the contents of a Next.js page with a fade + slide-up entry.
 * Place this around the outermost element returned by a page component.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// ── FadeIn ────────────────────────────────────────────────────────────────────
type FadeInProps = {
  children: ReactNode;
  /** Delay before the animation begins (seconds). Default: 0 */
  delay?: number;
  /** Duration of the fade. Default: 0.4 */
  duration?: number;
  /** Vertical distance to travel (px). Default: 20 */
  y?: number;
  className?: string;
};

/**
 * Fades + slides an element up when it enters the viewport.
 * Uses IntersectionObserver so it only fires once (triggerOnce).
 */
export function FadeIn({ children, delay = 0, duration = 0.4, y = 20, className }: FadeInProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// ── StaggerChildren ───────────────────────────────────────────────────────────
type StaggerChildrenProps = {
  children: ReactNode;
  /** Delay between each child animation (seconds). Default: 0.07 */
  stagger?: number;
  /** Base delay before the first child (seconds). Default: 0 */
  delay?: number;
  className?: string;
};

const containerVariants = (stagger: number, delay: number) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

const childVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/**
 * Wraps its children in a stagger container.
 * Each direct child receives a fade + slide-up, one after another.
 */
export function StaggerChildren({
  children,
  stagger = 0.07,
  delay = 0,
  className,
}: StaggerChildrenProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -30px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants(stagger, delay)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

/**
 * Use this around each direct child inside StaggerChildren.
 * (Optional convenience wrapper — StaggerChildren auto-propagates variants
 *  to any child wrapped in <motion.div> too, but this is more explicit.)
 */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={childVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ── AnimatePresenceWrapper ────────────────────────────────────────────────────
/**
 * Thin wrapper around AnimatePresence for conditional rendering with exit animation.
 * Use `mode="wait"` (default) so incoming and outgoing elements don't overlap.
 */
export function Presence({
  children,
  mode = "wait",
}: {
  children: ReactNode;
  mode?: "wait" | "sync" | "popLayout";
}) {
  return <AnimatePresence mode={mode}>{children}</AnimatePresence>;
}

// ── SlideIn ───────────────────────────────────────────────────────────────────
/**
 * Slides an element in from below when it mounts.
 * Great for results sections, success banners, modals.
 */
export function SlideIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.38, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// ── CountUp ───────────────────────────────────────────────────────────────────
type CountUpProps = {
  value: number;
  /** Duration of the count (seconds). Default: 0.6 */
  duration?: number;
  className?: string;
};

/** Animates a number counting up from 0 to `value` on mount / whenever `value` changes. */
export function CountUp({ value, duration = 0.6, className }: CountUpProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Border-radius (px). Default: 8 */
  radius?: number;
};

/**
 * Shimmer skeleton placeholder.
 * Use width/height/className to size it appropriately.
 */
export function Skeleton({ className = "", radius = 8, style, ...rest }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{ borderRadius: radius, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

// ── PageLoader ────────────────────────────────────────────────────────────────
type PageLoaderProps = {
  /** Text shown next to the spinner. Default: "Loading…" */
  label?: string;
  className?: string;
};

/**
 * Motion loading indicator — two counter-rotating rings + a breathing label.
 * Use in place of static "Loading…" text for brief async checks (auth gates,
 * account checks). For content that's about to appear in a known shape
 * (a list, a table), prefer `Skeleton` shaped like that content instead.
 * For a full-page boot moment (signing in, first load), use `BrandLoader`.
 */
export function PageLoader({ label = "Loading…", className = "" }: PageLoaderProps) {
  return (
    <div className={`flex items-center justify-center gap-3 py-1 ${className}`} role="status" aria-live="polite">
      <span className="relative h-5 w-5 shrink-0" aria-hidden="true">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-[#0E9484]/15 border-t-[#0E9484]"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-[3px] rounded-full border-2 border-transparent border-b-[#0E9484]/50"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
        />
      </span>
      <motion.span
        className="text-sm text-stone-600"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </div>
  );
}

// ── BrandLoader ───────────────────────────────────────────────────────────────
type BrandLoaderProps = {
  /** Text shown under the mark. Default: "Loading…" */
  label?: string;
  /** Small supporting line under the label, e.g. "This only takes a second." */
  sublabel?: string;
  className?: string;
};

/**
 * Full-page boot loader — a breathing logo mark inside an orbiting ring, with
 * an animated label underneath. Use for whole-screen waits like "signing you
 * in" or a post-auth redirect, where `PageLoader`'s compact inline spinner
 * would look lost. Caller is responsible for the page-level background/layout;
 * this only renders the centered mark + text.
 */
export function BrandLoader({ label = "Loading…", sublabel, className = "" }: BrandLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,148,132,0.22), transparent 70%)" }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        />
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-dashed border-[#0E9484]/35"
          animate={{ rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          aria-hidden="true"
        />
        <motion.img
          src="/logo-mark.png"
          alt=""
          aria-hidden="true"
          className="h-11 w-11 rounded-2xl object-cover shadow-sm"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <motion.span
          className="text-sm font-semibold"
          style={{ color: "#241A12" }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.span>
        {sublabel ? (
          <span className="text-xs" style={{ color: "#6B5D4F" }}>
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
