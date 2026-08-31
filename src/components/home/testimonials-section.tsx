import { MotionConfig } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/marketing/section-label";
import { StaggerChildren, StaggerItem } from "@/components/ui/animate";

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
    <div className="flex gap-0.5 text-brand-text">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="size-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="h-full border-line shadow-none transition-shadow duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-md">
      <CardContent className="flex flex-1 flex-col">
        <Stars count={testimonial.rating} />
        <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/80">
          &ldquo;{testimonial.review}&rdquo;
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy font-mono-editorial text-xs font-medium text-chalk">
            {testimonial.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">{testimonial.name}</p>
            <p className="text-xs text-muted-foreground">{testimonial.title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestimonialsSection() {
  return (
    <section className="border-t border-line py-16 sm:py-20">
      <Container>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <SectionLabel className="justify-center flex">Testimonials</SectionLabel>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Teachers on Layah
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Join thousands of teachers saving hours every week.
          </p>
        </div>

        {/* Native horizontal scroll-snap rather than framer-motion drag: it
            gets touch, trackpad, and keyboard scrolling for free without
            fighting a transform-based drag gesture over the same axis. */}
        <MotionConfig reducedMotion="user">
          <StaggerChildren
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            stagger={0.1}
          >
            {TESTIMONIALS.map((t) => (
              <StaggerItem
                key={t.name}
                className="w-[82%] max-w-sm shrink-0 snap-center sm:w-[340px]"
              >
                <TestimonialCard testimonial={t} />
              </StaggerItem>
            ))}
          </StaggerChildren>
        </MotionConfig>
      </Container>
    </section>
  );
}
