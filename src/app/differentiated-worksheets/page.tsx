import { getVerifiedUser } from "@/lib/verified-user";
import { DifferentiatedWorksheetPack } from "@/components/differentiated-pack/differentiated-worksheet-pack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DifferentiatedWorksheetsPage() {
  await getVerifiedUser();

  // As with the other generators: the component owns its title, width and
  // gated states, so the route no longer stacks a second heading on top.
  return <DifferentiatedWorksheetPack />;
}
