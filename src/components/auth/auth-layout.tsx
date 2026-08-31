"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { StaggerChildren, StaggerItem } from "@/components/ui/animate";

const CURRICULA = ["CBSE", "ICSE", "IB", "Cambridge"] as const;

const LESSON_STEPS = [
  { title: "Learning objectives", description: "What students will know and be able to do" },
  { title: "Teaching sequence", description: "Step-by-step flow for the period" },
  { title: "Differentiation", description: "Support for every learner" },
  { title: "Closure & assessment", description: "Check for understanding" },
] as const;

/**
 * Shell for /login and /signup.
 *
 * A previous version split the page into a navy panel with a decorative blob
 * on the left and the form on the right — at most widths the left half read
 * as empty, a large branded rectangle doing no work, and it vanished below
 * `lg`, so desktop and mobile had nothing in common. That was replaced with a
 * single centred column, which fixed the emptiness but gave up the chance to
 * say anything about the product before the form.
 *
 * This version restores the split at `lg`+, but the left panel is the
 * product's own sequence — the ruled-rail motif from tokens.css, standing in
 * for an actual lesson plan rather than illustration — plus a real teacher
 * quote. Below `lg` it collapses to exactly the single-column layout: no
 * breakpoint gets an empty rectangle.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full lg:grid lg:grid-cols-2">
      <HeroBackdrop />

      {/* Illustration panel — lg+ only */}
      <div className="relative z-10 hidden border-r border-line px-16 lg:flex lg:flex-col lg:justify-center">
        <MotionConfig reducedMotion="user">
          <StaggerChildren className="max-w-md" stagger={0.08}>
            <StaggerItem>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-text">
                For teachers, not templates
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                Every lesson, planned the way you&apos;d plan it yourself
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Layah builds a complete lesson package — objectives, sequence,
                differentiation, and closure — aligned to your curriculum.
              </p>
            </StaggerItem>

            <StaggerItem className="on-surface mt-8 rounded-xl border border-line bg-surface p-5">
              <div className="rule-rail flex flex-col gap-4">
                {LESSON_STEPS.map((step, i) => (
                  <div key={step.title} className="rule-item" data-rule-num={i + 1} data-state="done">
                    <p className="text-[13px] font-medium text-ink">{step.title}</p>
                    <p className="text-xs text-faint">{step.description}</p>
                  </div>
                ))}
              </div>
            </StaggerItem>

            <StaggerItem className="mt-8 border-l-2 border-brand-border pl-4">
              <p className="text-sm leading-relaxed text-muted">
                &ldquo;What used to take me 3 hours now takes 3–5 minutes.&rdquo;
              </p>
              <p className="mt-1.5 text-xs text-faint">— Sarah Ahmed, Science Teacher, Dubai</p>
            </StaggerItem>
          </StaggerChildren>
        </MotionConfig>
      </div>

      {/* Form panel */}
      <div className="relative z-10 flex min-h-[calc(100vh-64px)] w-full flex-col items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-[400px] flex-col items-center">
          <Link href="/" className="mb-7 flex flex-col items-center gap-2.5">
            <img
              src="/logo-mark.png"
              alt=""
              aria-hidden
              className="size-10 rounded-lg object-cover"
            />
            <span className="text-center">
              <span className="block text-[15px] font-semibold tracking-[-0.015em] text-ink">Layah</span>
              <span className="mt-0.5 block text-[12px] text-faint">Prep less. Teach more.</span>
            </span>
          </Link>

          {children}

          {/* Trust signal as one quiet line rather than a row of floating chips.
              It supports the decision without competing with the form. */}
          <p className="mt-7 text-center text-[11px] leading-relaxed text-disabled">
            Curriculum-aligned for{" "}
            <span className="text-faint">{CURRICULA.join(", ")}</span> and 15+ more
          </p>
        </div>
      </div>
    </div>
  );
}
