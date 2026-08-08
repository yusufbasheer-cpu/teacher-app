import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";
import { SecondaryPageHero } from "@/components/layout/secondary-page-hero";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DifferentiatedWorksheetsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen pb-16 pt-8">
      {user?.id ? (
        <Container>
          <h1 className="sr-only">Differentiated Worksheet Pack</h1>
        </Container>
      ) : (
        <SecondaryPageHero
          badge="AI Teaching Resources"
          headline="Create differentiated worksheets instantly"
          subtext="Generate foundation, core, and extension worksheets with answer keys and rubrics from one lesson topic."
          ctaLabel="Start Generating"
          ctaHref="/signup"
        />
      )}
      <Container>
        <DifferentiatedWorksheetPack />
      </Container>
    </main>
  );
}
