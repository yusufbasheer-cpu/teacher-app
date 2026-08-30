"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Layers3,
  ListOrdered,
  MousePointer2,
  NotebookPen,
  Plus,
  Presentation,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const teachers = [
  { initials: "PS", bg: "var(--brand)" },
  { initials: "RK", bg: "var(--text)" },
  { initials: "AN", bg: "var(--brand)" },
  { initials: "MJ", bg: "var(--text)" },
];

interface LessonPlanBentoProps {
  className?: string;
}

const bentoCardClass = cn(
  "group relative flex flex-col justify-between overflow-hidden rounded-xl bg-muted p-4 lg:p-6 duration-300 antialiased",
  "shadow-[inset_0_0_2px_2px_rgba(255,255,255,1),inset_0_0_0_1px_rgba(0,0,0,0.2),0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_-1px_rgba(0,0,0,0.08),0px_2px_4px_0px_rgba(0,0,0,0.06)]",
  "dark:shadow-[inset_0_0_2px_2px_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(255,255,255,0.08),0px_0px_0px_1px_rgba(255,255,255,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.5),0px_2px_4px_0px_rgba(0,0,0,0.4)]",
);

/** Brand bento for the homepage "See what teachers receive" section.
 * Adapted from a generic SaaS bento template — layout/animation structure
 * kept as-is, content and accent colors (blue/purple/emerald → brand
 * teal/navy) swapped for Layah. */
export function LessonPlanBento({ className }: LessonPlanBentoProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <div className={cn("site-editorial w-full font-sans antialiased", className)}>
      <div className="flex w-full flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Top Left Card — Lesson Plans */}
          <div
            className={cn(bentoCardClass, "flex min-h-[320px] flex-col md:col-span-2")}
            onMouseEnter={() => setHoveredCard(1)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            {/* Mockup UI at the top */}
            <div className="relative mb-8 flex flex-1 items-start justify-center overflow-visible">
              <motion.div
                className="bg-background/90 border-border relative flex w-full max-w-sm -translate-y-6 flex-col rounded-b-2xl border border-t-0 p-4 shadow-sm z-20"
                initial={{ marginBottom: 0 }}
                animate={hoveredCard === 1 ? { marginBottom: -44 } : { marginBottom: 0 }}
                transition={{ duration: 0.4, delay: hoveredCard === 1 ? 1.3 : 0, ease: "easeInOut" }}
              >
                {/* Step 1 */}
                <motion.div
                  className="bg-background relative flex items-center gap-3 rounded-xl border border-border p-3 shadow-sm z-10"
                  initial={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-primary/10 text-primary dark:bg-primary/20 flex size-8 items-center justify-center rounded-lg shadow-sm">
                    <Target className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground text-xs font-bold">Learning Objectives</span>
                    <span className="text-muted-foreground text-xs font-medium">
                      What students will learn
                    </span>
                  </div>
                </motion.div>

                {/* Connector */}
                <div className="relative mx-auto h-6 w-px z-0">
                  <div className="absolute inset-0 w-full bg-border" />
                  <motion.div
                    className="bg-primary absolute top-0 w-full"
                    initial={{ height: "0%" }}
                    animate={hoveredCard === 1 ? { height: "100%" } : { height: "0%" }}
                    transition={{ duration: 0.3, delay: hoveredCard === 1 ? 0.1 : 0, ease: "linear" }}
                  />
                </div>

                {/* Step 2 */}
                <motion.div
                  className="bg-background relative flex items-center gap-3 rounded-xl border border-border p-3 shadow-sm z-10"
                  initial={{ opacity: 0.5, scale: 0.98 }}
                  animate={hoveredCard === 1 ? { opacity: 1, scale: 1 } : { opacity: 0.5, scale: 0.98 }}
                  transition={{ duration: 0.4, delay: hoveredCard === 1 ? 0.4 : 0 }}
                >
                  <div className="bg-navy/10 text-navy dark:bg-navy/20 flex size-8 items-center justify-center rounded-lg shadow-sm">
                    <ListOrdered className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground text-xs font-bold">Teaching Sequence</span>
                    <span className="text-muted-foreground text-xs font-medium">
                      Step-by-step lesson flow
                    </span>
                  </div>
                </motion.div>

                {/* Connector */}
                <div className="relative mx-auto h-6 w-px z-0">
                  <div className="absolute inset-0 w-full bg-border" />
                  <motion.div
                    className="bg-navy absolute top-0 w-full"
                    initial={{ height: "0%" }}
                    animate={hoveredCard === 1 ? { height: "100%" } : { height: "0%" }}
                    transition={{ duration: 0.3, delay: hoveredCard === 1 ? 0.7 : 0, ease: "linear" }}
                  />
                </div>

                {/* Step 3 */}
                <motion.div
                  className="bg-background relative flex items-center gap-3 rounded-xl border border-border p-3 shadow-sm z-10"
                  initial={{ opacity: 0.5, scale: 0.98 }}
                  animate={hoveredCard === 1 ? { opacity: 1, scale: 1 } : { opacity: 0.5, scale: 0.98 }}
                  transition={{ duration: 0.4, delay: hoveredCard === 1 ? 1.0 : 0 }}
                >
                  <div className="bg-primary/10 text-primary dark:bg-primary/20 flex size-8 items-center justify-center rounded-lg shadow-sm">
                    <Layers3 className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground text-xs font-bold">Differentiation</span>
                    <span className="text-muted-foreground text-xs font-medium">
                      Support every learner
                    </span>
                  </div>
                </motion.div>

                {/* Sliding Bonus Panel — Closure Activities */}
                <motion.div
                  className="bg-primary/5 ring-primary/20 overflow-hidden rounded-lg ring-1"
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={
                    hoveredCard === 1
                      ? { height: 36, opacity: 1, marginTop: 8 }
                      : { height: 0, opacity: 0, marginTop: 0 }
                  }
                  transition={{ duration: 0.4, delay: hoveredCard === 1 ? 1.3 : 0, ease: "easeInOut" }}
                >
                  <div className="flex items-center justify-between w-full h-full px-3">
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={hoveredCard === 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                      transition={{ duration: 0.3, delay: hoveredCard === 1 ? 1.6 : 0 }}
                    >
                      <svg className="text-primary size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--brand-active)" }}>
                        Closure Activities
                      </span>
                    </motion.div>

                    <motion.div
                      className="bg-primary/10 border-primary/20 rounded border px-2 py-0.5 text-[9px] font-bold"
                      style={{ color: "var(--brand-active)" }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={hoveredCard === 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                      transition={{ type: "spring", delay: hoveredCard === 1 ? 1.8 : 0 }}
                    >
                      READY TO TEACH
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            <div className="relative z-10 flex flex-col gap-2">
              <h3 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
                Lesson Plans <NotebookPen className="text-primary size-6" />
              </h3>
              <p className="text-muted-foreground max-w-lg text-base text-balance">
                Complete lesson plans with learning objectives, a teaching sequence, built-in
                differentiation, and closure activities — generated from your chapter in seconds.
              </p>
            </div>
          </div>

          {/* Top Right Card — PPT Slides */}
          <div
            className={cn(bentoCardClass, "min-h-[320px] flex-col justify-between p-0 md:col-span-1 md:p-0")}
            onMouseEnter={() => setHoveredCard(2)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="relative z-10 flex flex-col gap-2 p-4 lg:p-6">
              <h3 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
                PPT Slides
              </h3>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                Slide-by-slide content, visual prompts, discussion questions, and key
                explanations — ready to present.
              </p>
            </div>

            <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden">
              {/* Background Grid Pattern */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] mask-[radial-gradient(ellipse_60%_60%_at_center,white_30%,transparent_100%)] bg-size-[24px_24px] dark:bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)]" />

              {/* Background Cross Lines */}
              <div className="bg-primary/20 absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 mask-[linear-gradient(to_right,transparent,white_50%,transparent)]" />
              <div className="bg-primary/20 absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 mask-[linear-gradient(to_bottom,transparent,white_50%,transparent)]" />

              {/* Animated Beams on Hover */}
              <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 overflow-hidden mask-[linear-gradient(to_right,transparent,white_50%,transparent)]">
                <motion.div
                  className="from-transparent via-primary absolute inset-y-0 w-1/2 bg-linear-to-r to-transparent"
                  initial={{ left: "-50%" }}
                  animate={hoveredCard === 2 ? { left: "100%" } : { left: "-50%" }}
                  transition={{ duration: 2, ease: "linear", repeat: hoveredCard === 2 ? Infinity : 0 }}
                />
                <motion.div
                  className="from-transparent via-primary absolute inset-y-0 w-1/2 bg-linear-to-l to-transparent"
                  initial={{ right: "-50%" }}
                  animate={hoveredCard === 2 ? { right: "100%" } : { right: "-50%" }}
                  transition={{ duration: 2.5, ease: "linear", repeat: hoveredCard === 2 ? Infinity : 0, delay: 0.5 }}
                />
              </div>

              <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 overflow-hidden mask-[linear-gradient(to_bottom,transparent,white_50%,transparent)]">
                <motion.div
                  className="from-transparent via-primary absolute inset-x-0 h-1/2 bg-linear-to-b to-transparent"
                  initial={{ top: "-50%" }}
                  animate={hoveredCard === 2 ? { top: "100%" } : { top: "-50%" }}
                  transition={{ duration: 2.2, ease: "linear", repeat: hoveredCard === 2 ? Infinity : 0, delay: 0.2 }}
                />
                <motion.div
                  className="from-transparent via-primary absolute inset-x-0 h-1/2 bg-linear-to-t to-transparent"
                  initial={{ bottom: "-50%" }}
                  animate={hoveredCard === 2 ? { bottom: "100%" } : { bottom: "-50%" }}
                  transition={{ duration: 1.8, ease: "linear", repeat: hoveredCard === 2 ? Infinity : 0, delay: 0.8 }}
                />
              </div>

              {/* Slide deck glyph + AI sparkle badge */}
              <div className="relative z-10 flex scale-[0.85] items-center justify-center transition-transform duration-500 ease-out">
                <Presentation
                  className="text-primary drop-shadow-[0_12px_24px_color-mix(in oklch, var(--brand) 25%, transparent)]"
                  style={{ width: 168, height: 168 }}
                  strokeWidth={1.25}
                />
                <div className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex size-12 items-center justify-center rounded-2xl shadow-lg">
                  <Sparkles className="size-6" strokeWidth={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card — Worksheets & Assessment */}
          <div
            className={cn(
              bentoCardClass,
              "min-h-[280px] flex-col items-stretch gap-8 p-0! md:col-span-3 md:flex-row",
            )}
            onMouseEnter={() => setHoveredCard(3)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-3 p-6 md:p-8">
              <h3 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
                Worksheets &amp; Assessment{" "}
                <ClipboardCheck className="fill-primary/20 text-primary size-6" />
              </h3>
              <p className="text-muted-foreground max-w-lg text-base text-balance">
                Practice questions, exit tickets, homework, and teacher notes — differentiated by
                level and ready to print.
              </p>
              <Link
                href="/lesson-plan"
                className="bg-foreground text-background mt-4 inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold shadow-[inset_0_0_0_2px_rgba(255,255,255,1),0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_-1px_rgba(0,0,0,0.08),0px_2px_4px_0px_rgba(0,0,0,0.06)] transition-transform hover:opacity-90 active:scale-[0.96]"
              >
                Start Generating
              </Link>
            </div>

            <div className="relative flex min-h-[260px] w-full flex-1 items-end justify-end overflow-visible rounded-br-3xl pt-4 md:pt-8">
              <div className="relative flex w-[110%] flex-col transition-transform duration-500 ease-out">
                {/* Avatar Stack */}
                <div className="relative z-20 mb-4 flex -space-x-3">
                  {teachers.map((teacher) => (
                    <div
                      key={teacher.initials}
                      className="border-background flex size-10 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-sm transition-transform duration-300 hover:scale-110"
                      style={{ background: teacher.bg }}
                    >
                      {teacher.initials}
                    </div>
                  ))}
                  <div className="border-background bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full border-2 shadow-sm">
                    <Plus className="size-4" />
                  </div>
                </div>

                {/* Mockup UI */}
                <div className="bg-background border-border relative flex min-h-[220px] w-full flex-col gap-4 overflow-hidden rounded-tl-2xl border-t border-l p-4 pt-8 shadow-sm">
                  <motion.div
                    className="bg-muted mb-2 h-5 rounded-md"
                    initial={{ width: "75%" }}
                    animate={hoveredCard === 3 ? { width: "80%" } : { width: "75%" }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  <motion.div
                    className="bg-muted/50 h-3 rounded-md"
                    initial={{ width: "100%" }}
                    animate={hoveredCard === 3 ? { width: "95%" } : { width: "100%" }}
                    transition={{ duration: 0.7, delay: 0.075, ease: "easeOut" }}
                  />
                  <motion.div
                    className="bg-muted/50 h-3 rounded-md"
                    initial={{ width: "83.333333%" }}
                    animate={hoveredCard === 3 ? { width: "85%" } : { width: "83.333333%" }}
                    transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                  />

                  {/* Cursor 1 — AI drafting */}
                  <motion.div
                    className="absolute top-14 left-[20%] z-20 flex flex-col items-start drop-shadow-md"
                    initial={{ x: 0, y: 0 }}
                    animate={hoveredCard === 3 ? { x: 32, y: 12 } : { x: 0, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    <MousePointer2 className="text-primary fill-primary size-4 -rotate-12" />
                    <div className="bg-primary mt-1 ml-2 rounded-md rounded-tl-none px-1.5 py-0.5 text-[10px] font-bold text-white">
                      AI
                    </div>
                  </motion.div>

                  <motion.div
                    className="bg-muted/50 h-3 rounded-md"
                    initial={{ width: "91.666667%" }}
                    animate={hoveredCard === 3 ? { width: "90%" } : { width: "91.666667%" }}
                    transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                  />

                  {/* Cursor 2 — Teacher reviewing */}
                  <motion.div
                    className="absolute right-[25%] bottom-10 z-20 flex flex-col items-start drop-shadow-md"
                    initial={{ x: 0, y: 0 }}
                    animate={hoveredCard === 3 ? { x: -24, y: -16 } : { x: 0, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    <MousePointer2 className="text-navy fill-navy size-4 -rotate-12" />
                    <div className="bg-navy mt-1 ml-2 rounded-md rounded-tl-none px-1.5 py-0.5 text-[10px] font-bold text-white">
                      You
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
