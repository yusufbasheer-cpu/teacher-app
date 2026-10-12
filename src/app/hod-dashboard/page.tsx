import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { getHodTeacherRow, getHodDashboard } from "@/lib/hod-server";
import { HodDashboard } from "@/components/hod/hod-dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "HOD Dashboard",
  robots: { index: false, follow: false },
};

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
    <div className="workspace-page">
          <HodDashboard data={dashboardData} />
    </div>
  );
}
