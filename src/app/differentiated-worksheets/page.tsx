import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DifferentiatedWorksheetsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/auth");
  }

  return (
    <main className="min-h-screen pb-16 pt-8">
      <Container>
        <h1 className="sr-only">Differentiated Worksheet Pack</h1>
        <DifferentiatedWorksheetPack />
      </Container>
    </main>
  );
}
