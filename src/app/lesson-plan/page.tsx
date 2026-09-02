import { Suspense } from "react";
import { getVerifiedUser } from "@/lib/verified-user";
import { LessonPlanGenerator } from "@/components/lesson-plan/lesson-plan-generator";
import { SchoolWelcomeBanner } from "@/components/school/school-welcome-banner";
import { ComposerSkeleton } from "@/components/app/route-skeletons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LessonPlanPage() {
  await getVerifiedUser();

  // The composer owns the page: title, width and its own signed-out state.
  // This route used to stack a `PageHeader` ("Generate Lesson Plan") on top of
  // it for signed-in users — two titles for one screen — and, for signed-out
  // visitors, a full marketing hero re-pitching the product to someone who is
  // already trying to use it.
  //
  // The inner Suspense (LessonPlanGenerator reads useSearchParams, which
  // requires one) is distinct from this route's own loading.tsx: loading.tsx
  // covers the server round-trip before this component even starts streaming;
  // this one covers the moment between that and the client hook resolving.
  // Same shape for both, so there's no visible seam between them.
  return (
    <>
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 sm:px-6">
        <SchoolWelcomeBanner />
      </div>
      <Suspense fallback={<ComposerSkeleton />}>
        <LessonPlanGenerator />
      </Suspense>
    </>
  );
}
