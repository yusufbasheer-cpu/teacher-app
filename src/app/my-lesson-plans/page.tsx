import { redirect } from "next/navigation";
import { MyLessonPlansList } from "@/components/lesson-plan/my-lesson-plans-list";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MyLessonPlansPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/auth");
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
