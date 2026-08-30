import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { MyLessonPlansList } from "@/components/lesson-plan/my-lesson-plans-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MyLessonPlansPage() {
  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  // The list owns its own page width and padding. The old `Container` +
  // `FadeIn` wrapper added a second width cap on top of the frame's and faded
  // the whole page in on every visit, which delayed content for no signal.
  return <MyLessonPlansList />;
}
