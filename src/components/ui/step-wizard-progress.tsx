"use client";

import { motion } from "motion/react";
import { BorderTrail } from "@/components/motion-primitives/border-trail";

type WizardStep = {
  id: number;
  label: string;
};

type Props = {
  steps: readonly WizardStep[];
  currentStep: number;
};

/** Horizontal numbered stepper shared by the lesson plan, question paper, and
 * differentiated worksheet wizards — active step filled teal (with a subtle
 * BorderTrail glow, same treatment as the homepage CTA), completed steps show
 * a checkmark, and the connecting line fills in teal segment-by-segment as
 * each step is completed instead of sitting static. */
export function StepWizardProgress({ steps, currentStep }: Props) {
  const segmentWidthPct = 100 / steps.length;

  return (
    <div className="relative w-full px-2">
      <div className="absolute left-2 right-2 top-4 h-0.5" aria-hidden="true">
        <div className="absolute inset-0 rounded-full" style={{ background: "var(--border)" }} />
        {steps.slice(0, -1).map((s, i) => (
          <motion.div
            key={s.id}
            className="absolute top-0 h-full origin-left rounded-full"
            style={{ left: `${(i + 0.5) * segmentWidthPct}%`, width: `${segmentWidthPct}%`, background: "var(--brand)" }}
            initial={false}
            animate={{ scaleX: currentStep > s.id ? 1 : 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        ))}
      </div>
      <ol className="relative flex justify-between">
        {steps.map(({ id, label }) => {
          const isActive = currentStep === id;
          const isDone = currentStep > id;
          return (
            <li key={id} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition"
                style={{
                  borderColor: isActive || isDone ? "var(--brand)" : "var(--border)",
                  background: isActive ? "var(--brand)" : isDone ? "var(--brand-active)" : "#fff",
                  color: isActive || isDone ? "#fff" : "var(--text-disabled)",
                }}
                aria-current={isActive ? "step" : undefined}
              >
                {isActive ? (
                  <BorderTrail
                    className="bg-[var(--text)]"
                    size={20}
                    style={{ boxShadow: "0 0 6px 1px color-mix(in oklch, var(--text) 50%, transparent)" }}
                  />
                ) : null}
                {isDone ? "✓" : id}
              </span>
              <span
                className="text-center text-xs font-semibold"
                style={{ color: isActive ? "var(--text)" : isDone ? "var(--brand-active)" : "var(--text-disabled)" }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
