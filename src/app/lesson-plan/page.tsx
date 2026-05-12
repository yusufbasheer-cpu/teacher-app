import { Suspense } from "react";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { Container } from "@/components/ui/container";

function LessonPlanFallback() {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-6 text-sm text-slate-600 shadow-sm">
      Loading lesson planner…
    </div>
  );
}

export default function LessonPlanPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <div className="mb-8 rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-sm sm:p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            AI Lesson Plan Generator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Generate a full teacher package: structured lesson plan, slide-by-slide PPT
            content, worksheet, assessments, homework, and teacher notes—aligned to your
            subject and grade.
          </p>
        </div>
        <Suspense fallback={<LessonPlanFallback />}>
          <LessonPlanGenerator />
        </Suspense>
      </Container>
    </main>
  );
}
