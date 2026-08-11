import { getVerifiedUser } from "@/lib/verified-user";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";
import { SecondaryPageHero } from "@/components/layout/secondary-page-hero";
import { PageHeader } from "@/components/layout/page-header";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DifferentiatedWorksheetsPage() {
  const user = await getVerifiedUser();

  return (
    <main className="min-h-screen pb-16 pt-8">
      {user?.id ? (
        <Container className="pt-2">
          <PageHeader
            title="Differentiated Worksheet Pack"
            description="Generate foundation, core, and extension worksheets with answer keys and rubrics from one lesson topic."
          />
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
