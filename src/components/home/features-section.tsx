import Link from "next/link";
import { Container } from "@/components/ui/container";

const features = [
  {
    emoji: "📝",
    title: "Lesson Plan Generator",
    href: "/lesson-plan",
    description:
      "Create complete lesson structures with objectives, activities, assessments, and timing suggestions — ready in seconds.",
  },
  {
    emoji: "📋",
    title: "Question Paper Generator",
    href: "/question-paper",
    description:
      "Build exam papers with multiple question types, blueprints, and Word downloads for your classroom.",
  },
  {
    emoji: "🖥️",
    title: "PowerPoint Outline Builder",
    href: "/lesson-plan",
    description:
      "Turn lesson content into clear slide-by-slide outlines ready to paste into PowerPoint or download directly.",
  },
  {
    emoji: "🎯",
    title: "Curriculum Alignment",
    href: "/lesson-plan",
    description:
      "Keep plans aligned to grade level outcomes and learning standards for consistent quality across every lesson.",
  },
  {
    emoji: "🎨",
    title: "Differentiated Worksheets",
    href: "/differentiated-worksheets",
    description:
      "Generate tiered worksheet packs for different ability levels — supporting every learner in your classroom.",
  },
  {
    emoji: "✅",
    title: "AFL Activity Tools",
    href: "/lesson-plan",
    description:
      "31 built-in Assessment for Learning tools to make your lessons more engaging and evidence-based.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-24" style={{ background: "#F0FDFB" }}>
      <Container>
        <div className="mb-12 text-center">
          <p
            className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(0,198,167,0.12)", color: "#00C6A7" }}
          >
            Features
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: "#0A1628" }}>
            Everything teachers need 🧑‍🏫
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "#374151" }}>
            A clean workflow focused on planning, preparing, and presenting effective lessons — so you can spend more time with your students.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-lg hover:-translate-y-0.5"
              style={{ borderColor: "rgba(0,198,167,0.15)" }}
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                style={{ background: "rgba(0,198,167,0.1)" }}
              >
                {feature.emoji}
              </div>
              <h3 className="text-base font-bold" style={{ color: "#0A1628" }}>
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#374151" }}>
                {feature.description}
              </p>
              <Link
                href={feature.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition hover:gap-2"
                style={{ color: "#00C6A7" }}
              >
                Open tool →
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
