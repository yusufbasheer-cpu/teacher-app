import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/verified-user";
import { WorkspaceClient } from "@/components/dashboard/workspace-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function OverviewPage() {
  const user = await getVerifiedUser();

  if (!user?.id) {
    redirect("/login");
  }

  return <WorkspaceClient />;
}
