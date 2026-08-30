import { Suspense } from "react";
import { getVerifiedUser } from "@/lib/verified-user";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { SchoolWelcomeBanner } from "@/components/school/school-welcome-banner";
import { Skeleton } from "@/components/ui/panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Skeleton in the composer's shape so the layout doesn't jump on hydration. */
function LessonPlanFallback() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
      <Skeleton className="h-6 w-40" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[420px] rounded-lg" />
        <Skeleton className="h-[280px] rounded-lg" />
      </div>
    </div>
  );
}

export default async function LessonPlanPage() {
  await getVerifiedUser();

  // The composer owns the page: title, width and its own signed-out state.
  // This route used to stack a `PageHeader` ("Generate Lesson Plan") on top of
  // it for signed-in users — two titles for one screen — and, for signed-out
  // visitors, a full marketing hero re-pitching the product to someone who is
  // already trying to use it.
  return (
    <>
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 sm:px-6">
        <SchoolWelcomeBanner />
      </div>
      <Suspense fallback={<LessonPlanFallback />}>
        <LessonPlanGenerator />
      </Suspense>
    </>
  );
}
