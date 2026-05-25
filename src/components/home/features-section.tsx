import Link from "next/link";
import { Container } from "@/components/ui/container";

const features = [
  {
    title: "Lesson Plan Generator",
    href: "/lesson-plan",
    description:
      "Create complete lesson structures with objectives, activities, assessments, and timing suggestions.",
  },
  {
    title: "Question Paper Generator",
    href: "/question-paper",
    description:
      "Build exam papers with multiple question types, blueprints, and Word downloads for your classroom.",
  },
  {
    title: "PowerPoint Outline Builder",
    href: "/lesson-plan",
    description:
      "Turn lesson content into clear slide-by-slide outlines ready to paste into PowerPoint.",
  },
  {
    title: "Curriculum Alignment",
    href: "/lesson-plan",
    description:
      "Keep plans aligned to grade level outcomes and learning standards for consistent quality.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="pb-20 md:pb-24" style={{ background: "#F7F9FC" }}>
      <Container>
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#0A1628" }}>
            Everything teachers need to plan faster
          </h2>
          <p className="mt-3" style={{ color: "#4A5568" }}>
            A clean workflow focused on planning, preparing, and presenting effective lessons.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              style={{ borderColor: "rgba(0,198,167,0.2)" }}
            >
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(0,198,167,0.1)" }}
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#00C6A7" }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: "#0A1628" }}>
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6" style={{ color: "#4A5568" }}>
                {feature.description}
              </p>
              {"href" in feature && feature.href ? (
                <Link
                  href={feature.href}
                  className="mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
                  style={{ color: "#00C6A7" }}
                >
                  Open tool →
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
