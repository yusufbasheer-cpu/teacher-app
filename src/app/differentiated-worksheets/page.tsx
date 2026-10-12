import type { Metadata } from "next";
import { getVerifiedUser } from "@/lib/verified-user";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Differentiated Worksheets",
  robots: { index: false, follow: false },
};

export default async function DifferentiatedWorksheetsPage() {
  await getVerifiedUser();

  // As with the other generators: the component owns its title, width and
  // gated states, so the route no longer stacks a second heading on top.
  return <DifferentiatedWorksheetPack />;
}
