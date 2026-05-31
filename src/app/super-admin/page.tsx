import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import { SuperAdminPinGate } from "@/components/admin/super-admin-pin-gate";
import { isSuperAdmin, isSuperAdminEmail } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SuperAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/auth");
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
