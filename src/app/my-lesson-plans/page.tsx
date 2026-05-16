import { MyLessonPlansList } from "@/components/lesson-plan/my-lesson-plans-list";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export default function MyLessonPlansPage() {
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
