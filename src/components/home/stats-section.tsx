"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/container";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

type Stat = {
  value: number;
  suffix: string;
  label: string;
};

const STATS: Stat[] = [
  { value: 15, suffix: "+", label: "Curriculums Supported" },
  { value: 25, suffix: "+", label: "Subjects Available" },
  { value: 13, suffix: "", label: "Structured PPT Elements" },
  { value: 6, suffix: "", label: "Global Frameworks" },
  { value: 31, suffix: "", label: "Activity Sheet AFL Tools" },
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
    <div className="flex flex-col items-center rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
      <p className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: TEAL }}>
        {count}
        {stat.suffix}
      </p>
      <p className="mt-2 text-center text-sm font-semibold" style={{ color: NAVY }}>
        {stat.label}
      </p>
    </div>
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
    <section ref={ref} className="py-16 sm:py-20">
      <Container>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p
            className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}
          >
            Layah in Numbers
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Built for Every Classroom
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "#4A5568" }}>
            Trusted by teachers across the globe with comprehensive curriculum coverage and powerful tools.
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
