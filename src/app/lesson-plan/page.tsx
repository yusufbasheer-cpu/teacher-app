import { Suspense } from "react";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { SchoolWelcomeBanner } from "@/components/school/school-welcome-banner";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/animate";

function LessonPlanFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-4/5" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" radius={24} />
        <Skeleton className="h-96" radius={24} />
      </div>
    </div>
  );
}

export default function LessonPlanPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <SchoolWelcomeBanner />
        <div className="mb-8 rounded-3xl border bg-white p-5 shadow-sm sm:p-6 md:p-8" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0A1628" }}>
            AI Lesson Plan Generator
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "#4A5568" }}>
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
