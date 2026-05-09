import { Container } from "@/components/ui/container";

const features = [
  {
    title: "Lesson Plan Generator",
    description:
      "Create complete lesson structures with objectives, activities, assessments, and timing suggestions.",
  },
  {
    title: "PowerPoint Outline Builder",
    description:
      "Turn lesson content into clear slide-by-slide outlines ready to paste into PowerPoint.",
  },
  {
    title: "Curriculum Alignment",
    description:
      "Keep plans aligned to grade level outcomes and learning standards for consistent quality.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="pb-20 md:pb-24">
      <Container>
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Everything teachers need to plan faster
          </h2>
          <p className="mt-3 text-slate-600">
            A clean workflow focused on planning, preparing, and presenting effective lessons.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
