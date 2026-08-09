import { Suspense } from "react";
import { getVerifiedUser } from "@/lib/verified-user";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { SchoolWelcomeBanner } from "@/components/school/school-welcome-banner";
import { SecondaryPageHero } from "@/components/layout/secondary-page-hero";
import { Skeleton } from "@/components/ui/animate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export default async function LessonPlanPage() {
  const user = await getVerifiedUser();

  return (
    <main className="min-h-screen w-full pb-16 pt-8">
      {user?.id ? (
        <h1 className="sr-only">AI Lesson Plan Generator</h1>
      ) : (
        <SecondaryPageHero
          badge="AI Teaching Resources"
          headline="Generate curriculum-aligned lesson plans in minutes"
          subtext="Create structured lesson plans with objectives, activities, differentiation and assessments."
          ctaLabel="Start Generating"
          ctaHref="/signup"
        />
      )}
      <div className="px-4 sm:px-6 lg:px-8">
        <SchoolWelcomeBanner />
      </div>
      {/* No outer max-width here — the wizard (820px) and the generated
          package dashboard (7xl) each set their own width so neither gets
          silently clipped by an ancestor narrower than it needs. */}
      <Suspense fallback={<div className="px-4 sm:px-6 lg:px-8"><LessonPlanFallback /></div>}>
        <LessonPlanGenerator />
      </Suspense>
    </main>
  );
}
