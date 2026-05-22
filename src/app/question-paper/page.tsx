import { QuestionPaperGenerator } from "@/components/question-paper/question-paper-generator";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export default function QuestionPaperPage() {
  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #fff 40%)" }}>
      <Container>
        <FadeIn>
          <div
            className="mb-8 rounded-3xl border p-5 shadow-sm sm:p-6 md:p-8"
            style={{ borderColor: "rgba(0,198,167,0.25)", background: "#0A1628" }}
          >
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Question Paper Generator
            </h1>
            <p className="mt-2 max-w-3xl text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.75)" }}>
              Build curriculum-aligned exam papers with multiple question types, strict or AI-enhanced
              modes, and optional answer keys — styled for your classroom.
            </p>
          </div>
        </FadeIn>
        <QuestionPaperGenerator />
      </Container>
    </main>
  );
}
