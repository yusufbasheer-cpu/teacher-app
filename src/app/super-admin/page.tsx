import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import { SuperAdminPinGate } from "@/components/admin/super-admin-pin-gate";
import { isSuperAdmin, isSuperAdminEmail } from "@/lib/super-admin";
import { getVerifiedUser } from "@/lib/verified-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SuperAdminPage() {
  const user = await getVerifiedUser();

  if (!user?.email) {
    redirect("/login");
  }

  // Fast email pre-check before the async DB lookup
  if (!isSuperAdminEmail(user.email)) {
    redirect("/dashboard?access_denied=1");
  }

  // Authoritative DB role check
  const isAdmin = await isSuperAdmin(user.id, user.email);
  if (!isAdmin) {
    redirect("/dashboard?access_denied=1");
  }

  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <FadeIn>
          <SuperAdminPinGate>
            <SuperAdminDashboard />
          </SuperAdminPinGate>
        </FadeIn>
      </Container>
    </main>
  );
}
