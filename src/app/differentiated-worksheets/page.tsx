import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

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
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <FadeIn>
          <div className="mb-8 rounded-3xl border bg-white p-5 shadow-sm sm:p-6 md:p-8" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "#0A1628" }}>
              Differentiated Worksheet Pack
            </h1>
            <p className="mt-2 max-w-3xl text-sm sm:text-base" style={{ color: "#4A5568" }}>
              Build three leveled worksheets (Foundation, Core, Extension) from your Layah.ai lesson or
              from an uploaded plan, with answer keys, rubrics, teacher notes, and peer and self
              assessment sheets—UAE context and curriculum alignment included.
            </p>
          </div>
        </FadeIn>
        <DifferentiatedWorksheetPack />
      </Container>
    </main>
  );
}
