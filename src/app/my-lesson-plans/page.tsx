import { MyLessonPlansList } from "@/components/lesson-plan/my-lesson-plans-list";
import { Container } from "@/components/ui/container";

export default function MyLessonPlansPage() {
  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <MyLessonPlansList />
      </Container>
    </main>
  );
}
