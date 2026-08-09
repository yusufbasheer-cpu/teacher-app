import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { MyLessonPlansList } from "@/components/lesson-plan/my-lesson-plans-list";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MyLessonPlansPage() {
  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <FadeIn>
          <MyLessonPlansList />
        </FadeIn>
      </Container>
    </main>
  );
}
