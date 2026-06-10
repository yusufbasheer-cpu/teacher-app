import { LessonView } from "@/components/lesson-plan/lesson-view";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export default async function LessonViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <FadeIn>
          <LessonView id={id} />
        </FadeIn>
      </Container>
    </main>
  );
}
