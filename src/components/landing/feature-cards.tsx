"use client";

import { useRef } from "react";
import { useInView, MotionConfig } from "framer-motion";
import { ClipboardCheck, NotebookPen, Presentation } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: NotebookPen,
    title: "Lesson Plans",
    description:
      "Complete lesson plans with learning objectives, a teaching sequence, built-in differentiation, and closure activities — generated from your chapter in seconds.",
  },
  {
    icon: Presentation,
    title: "PPT Slides",
    description:
      "Slide-by-slide content, visual prompts, discussion questions, and key explanations — ready to present.",
  },
  {
    icon: ClipboardCheck,
    title: "Worksheets & Assessment",
    description:
      "Practice questions, exit tickets, homework, and teacher notes — differentiated by level and ready to print.",
  },
] as const;

const cardClass = cn(
  "border-line transition-[transform,box-shadow] duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)]",
  "hover:-translate-y-1 hover:shadow-pop"
);

function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
  const Icon = feature.icon;
  return (
    <Card className={cardClass}>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand-text">
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-lg">{feature.title}</CardTitle>
        <CardDescription className="text-[13px] leading-relaxed">
          {feature.description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function FeatureGrid({ animated }: { animated: boolean }) {
  const cards = FEATURES.map((feature) => <FeatureCard key={feature.title} feature={feature} />);

  if (!animated) {
    return <div className="grid gap-4 sm:grid-cols-3">{cards}</div>;
  }

  return (
    <AnimatedGroup preset="slide" className="grid gap-4 sm:grid-cols-3">
      {cards}
    </AnimatedGroup>
  );
}

/**
 * "See what teachers receive" — three feature cards, revealed with a stagger
 * once scrolled into view. AnimatedGroup itself animates immediately on
 * mount (fine for its other use in dashboard-overview.tsx, which mounts
 * already-in-view), so this section gates mounting it with the same
 * useInView idiom FadeIn/StaggerChildren already use in animate.tsx —
 * otherwise a below-the-fold section would finish animating before anyone
 * scrolls to it.
 */
export function FeatureCards() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref}>
        <FeatureGrid animated={inView} />
      </div>
    </MotionConfig>
  );
}
