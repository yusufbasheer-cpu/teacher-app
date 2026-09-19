const STEPS = [
  { title: "Bring your starting point", description: "Choose the curriculum, class and topic. Add your textbook or notes when you need resources based on specific material." },
  { title: "Shape the lesson", description: "Set your objectives, teaching approach and the resources you need. Generate a package that follows your choices." },
  { title: "Review, then teach", description: "Check the content for your learners, choose a presentation design and download the files you need for class." },
];

export function HowItWorksTimeline() {
  return (
    <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
      {STEPS.map((step, index) => (
        <li key={step.title} className="border-t border-line pt-5">
          <span className="text-sm font-semibold tabular-nums text-brand-text">0{index + 1}</span>
          <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}

