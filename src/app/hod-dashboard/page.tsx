import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { getHodTeacherRow, getHodDashboard } from "@/lib/hod-server";
import { HodDashboard } from "@/components/hod/hod-dashboard";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HodDashboardPage() {
  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  const hodRow = await getHodTeacherRow(user.id);

  if (!hodRow) {
    redirect("/dashboard?hod_denied=1");
  }

  const dashboardData = await getHodDashboard(hodRow);

  return (
    <main className="min-h-screen pb-16 pt-10">
      <Container>
        <FadeIn>
          <HodDashboard data={dashboardData} />
        </FadeIn>
      </Container>
    </main>
  );
}
