import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OverviewPage() {
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
        <DashboardOverview />
      </Container>
    </main>
  );
}
