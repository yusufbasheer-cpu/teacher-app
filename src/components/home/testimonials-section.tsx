"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/container";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";
const GOLD = "#F59E0B";

type Testimonial = {
  name: string;
  title: string;
  review: string;
  rating: number;
  initials: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah Ahmed",
    title: "Science Teacher, Dubai",
    review:
      "Layah has completely transformed my lesson planning. What used to take me 3 hours now takes 3–5 minutes. The PPT structure is exactly what my school requires for KHDA inspections.",
    rating: 5,
    initials: "SA",
  },
  {
    name: "Luke Cashio",
    title: "Math Teacher, UK",
    review:
      "The AFL tools integration is incredible. My students are more engaged and my lessons are much more structured. I recommend Layah to every teacher I know.",
    rating: 5,
    initials: "LC",
  },
  {
    name: "Priya Sharma",
    title: "English Teacher, Sharjah",
    review:
      "As a CBSE teacher I was amazed that Layah understands our curriculum so well. The differentiated worksheets save me hours every week.",
    rating: 5,
    initials: "PS",
  },
  {
    name: "James Wilson",
    title: "HOD Science, British School Dubai",
    review:
      "We got our whole department using Layah. The lesson plans are inspection ready and our teachers have more time to focus on students.",
    rating: 5,
    initials: "JW",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="size-4" viewBox="0 0 20 20" fill={GOLD}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial, visible }: { testimonial: Testimonial; visible: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-white p-6 shadow-sm transition-all duration-700 hover:shadow-md"
      style={{
        borderColor: "rgba(0,198,167,0.12)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      <Stars count={testimonial.rating} />
      <p className="mt-4 text-sm leading-relaxed" style={{ color: "#374151" }}>
        &ldquo;{testimonial.review}&rdquo;
      </p>
      <div className="mt-5 flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}
        >
          {testimonial.initials}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            {testimonial.name}
          </p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {testimonial.title}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-16 sm:py-20" style={{ background: "white" }}>
      <Container>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p
            className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}
          >
            Testimonials
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            What Teachers Are Saying
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "#4A5568" }}>
            Join thousands of teachers saving time with Layah
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} style={{ transitionDelay: `${i * 120}ms` }}>
              <TestimonialCard testimonial={t} visible={visible} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
