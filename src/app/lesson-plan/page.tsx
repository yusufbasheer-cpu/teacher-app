import { Suspense } from "react";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { Container } from "@/components/ui/container";

function LessonPlanFallback() {
  return (
    <div className="rounded-3xl border border-[#00C6A7]/20 bg-white p-6 text-sm text-slate-600 shadow-sm">
      Loading lesson planner…
    </div>
  );
}

export default function LessonPlanPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <div className="mb-8 rounded-3xl border bg-white p-5 shadow-sm sm:p-6 md:p-8" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0A1628" }}>
            AI Lesson Plan Generator
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "#4A5568" }}>
            Generate a full teacher package: structured lesson plan, slide-by-slide PPT
            content, worksheet, assessments, homework, and teacher notes—aligned to your
            subject and grade.
          </p>
          <p className="mt-3 max-w-2xl text-xs text-slate-500">
            If you see a JSON or network error, open{" "}
            <code className="rounded bg-slate-100 px-1">/api/deepseek-ping</code> in a new tab to check
            your DeepSeek API key. The server logs the raw DeepSeek response before parsing.
          </p>
        </div>
        <Suspense fallback={<LessonPlanFallback />}>
          <LessonPlanGenerator />
        </Suspense>
      </Container>
    </main>
  );
}
