"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/marketing/section-label";

type Stat = {
  value: number;
  suffix: string;
  label: string;
};

const STATS: Stat[] = [
  { value: 15, suffix: "+", label: "Curriculums supported" },
  { value: 25, suffix: "+", label: "Subjects available" },
  { value: 13, suffix: "", label: "Structured PPT elements" },
  { value: 6, suffix: "", label: "Global frameworks" },
  { value: 87, suffix: "", label: "Activity Sheet AFL tools" },
];

function useCountUp(target: number, duration: number, trigger: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (current !== start) {
        start = current;
        setCount(current);
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(step);
  }, [target, duration, trigger]);

  return count;
}

function StatCard({ stat, inView }: { stat: Stat; inView: boolean }) {
  const count = useCountUp(stat.value, 1500, inView);

  return (
    <Card className="items-center border-border py-6 text-center shadow-none">
      <p className="font-display text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
        {count}
        {stat.suffix}
      </p>
      <p className="mt-2 text-center text-sm font-medium leading-snug text-navy">{stat.label}</p>
    </Card>
  );
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="border-t border-border py-16 sm:py-20">
      <Container>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <SectionLabel className="justify-center flex">Layah in numbers</SectionLabel>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Built for every classroom
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Trusted by teachers across the globe with comprehensive curriculum coverage.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {STATS.map((stat) => (
            <StatCard key={stat.label} stat={stat} inView={inView} />
          ))}
        </div>
      </Container>
    </section>
  );
}
