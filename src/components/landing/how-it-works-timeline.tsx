"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import { NAVY, TEXT_MUTED } from "@/lib/design-tokens";

const STEPS = [
  {
    number: 1,
    title: "Enter your chapter",
    description: "Choose curriculum, grade, subject, and topic.",
  },
  {
    number: 2,
    title: "Add textbook content (optional)",
    description: "Upload a PDF, image, or paste notes.",
  },
  {
    number: 3,
    title: "Generate your teaching package",
    description: "Get lesson plans, PPTs, worksheets, homework, and assessments instantly.",
  },
] as const;

const DURATION = 0.5;
const STAGGER = 0.15;

function StepCircle({ number, delay }: { number: number; delay: number }) {
  return (
    <motion.span
      className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
      style={{ background: NAVY }}
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: DURATION, ease: "easeOut", delay }}
    >
      {number}
    </motion.span>
  );
}

function StepText({
  title,
  description,
  delay,
  className,
}: {
  title: string;
  description: string;
  delay: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: DURATION, ease: "easeOut", delay }}
    >
      <h3 className="text-base font-bold" style={{ color: NAVY }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
        {description}
      </p>
    </motion.div>
  );
}

/** "How it works" as a connected timeline — numbered circles linked by a
 * line that draws in as each step scrolls into view. Vertical (circle +
 * text side by side, line running down) below `sm`, horizontal (circle +
 * text stacked, line running across) at `sm` and up. */
export function HowItWorksTimeline() {
  return (
    <div className="mt-10">
      {/* Mobile — vertical timeline */}
      <div className="flex flex-col sm:hidden">
        {STEPS.map((step, i) => (
          <div key={step.number} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepCircle number={step.number} delay={i * STAGGER} />
              {i < STEPS.length - 1 && (
                <div className="w-0.5 flex-1 py-1">
                  <motion.div
                    className="h-full w-full origin-top"
                    style={{ background: NAVY, minHeight: 32 }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ duration: DURATION, ease: "easeOut", delay: i * STAGGER + 0.2 }}
                  />
                </div>
              )}
            </div>
            <StepText
              title={step.title}
              description={step.description}
              delay={i * STAGGER}
              className="pb-8"
            />
          </div>
        ))}
      </div>

      {/* Desktop — horizontal timeline */}
      <div className="hidden sm:flex sm:items-start">
        {STEPS.map((step, i) => (
          <Fragment key={step.number}>
            <div className="flex flex-1 flex-col items-center text-center">
              <StepCircle number={step.number} delay={i * STAGGER} />
              <StepText title={step.title} description={step.description} delay={i * STAGGER} className="mt-4" />
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex h-10 w-12 shrink-0 items-center md:w-20 lg:w-24" aria-hidden>
                <motion.div
                  className="h-0.5 w-full origin-left"
                  style={{ background: NAVY }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: DURATION, ease: "easeOut", delay: i * STAGGER + 0.25 }}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
