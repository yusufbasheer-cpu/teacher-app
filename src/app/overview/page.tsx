import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OverviewPage() {
  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen pb-16 pt-8">
      <Container>
        <DashboardOverview />
      </Container>
    </main>
  );
}
