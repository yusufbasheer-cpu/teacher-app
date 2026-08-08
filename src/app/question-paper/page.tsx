import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { QuestionPaperGenerator } from "@/components/question-paper/question-paper-generator";
import { SecondaryPageHero } from "@/components/layout/secondary-page-hero";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QuestionPaperPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen pb-16 pt-8">
      {user?.id ? (
        <Container>
          <h1 className="sr-only">Question Paper Generator</h1>
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
