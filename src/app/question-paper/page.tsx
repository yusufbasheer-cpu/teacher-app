import { getVerifiedUser } from "@/lib/verified-user";
import { QuestionPaperGenerator } from "@/components/question-paper/question-paper-generator";
import { SecondaryPageHero } from "@/components/layout/secondary-page-hero";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QuestionPaperPage() {
  const user = await getVerifiedUser();

  return (
    <main className="min-h-screen pb-16 pt-8">
      {user?.id ? (
        <Container className="pt-2">
          <PageHeader
            title="Generate Question Paper"
            description="Create a curriculum-aligned question paper with a custom blueprint, mark distribution, and answer key."
          />
        </Container>
      ) : (
        <SecondaryPageHero
          badge="AI Teaching Resources"
          headline="Generate question papers with AI"
          subtext="Create curriculum-aligned question papers with a custom blueprint, mark distribution, and answer key."
          ctaLabel="Start Generating"
          ctaHref="/signup"
        />
      )}
      <Container>
        <QuestionPaperGenerator />
      </Container>
    </main>
  );
}
