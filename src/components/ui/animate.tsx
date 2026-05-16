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

import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
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
