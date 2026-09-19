import Link from "next/link";
import { ArrowUpRight, BookOpen, ClipboardCheck, Layers } from "lucide-react";

const TOOLS = [
  { title: "Lesson packages", href: "/lesson-plan", icon: BookOpen, description: "A lesson plan, presentation and supporting resources built around your topic.", detail: "Plan · Present · Assess" },
  { title: "Question papers", href: "/question-paper", icon: ClipboardCheck, description: "Build an assessment with the right topics, question types and marks for your class.", detail: "Blueprint · Paper · Answer key" },
  { title: "Differentiated worksheets", href: "/differentiated-worksheets", icon: Layers, description: "Give learners the support or challenge they need, using the same source material.", detail: "Support · Core · Challenge" },
] as const;

export function LessonPlanBento() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TOOLS.map(({ title, href, icon: Icon, description, detail }) => (
        <Link key={href} href={href} className="group flex flex-col rounded-xl border border-line bg-surface p-6 transition-colors duration-150 hover:border-brand/50 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none">
          <div className="mb-8 flex items-center justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand-text"><Icon className="size-5" aria-hidden /></span><ArrowUpRight className="size-4 text-faint group-hover:text-brand-text" aria-hidden /></div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{description}</p>
          <p className="mt-6 border-t border-line pt-4 text-xs font-medium text-muted">{detail}</p>
        </Link>
      ))}
    </div>
  );
}

