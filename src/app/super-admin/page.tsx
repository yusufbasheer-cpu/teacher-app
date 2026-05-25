import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import { isSuperAdmin } from "@/lib/super-admin";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SuperAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/auth");
  }

  if (!isSuperAdmin(user.email)) {
    redirect("/dashboard?access_denied=1");
  }

  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <FadeIn>
          <SuperAdminDashboard />
        </FadeIn>
      </Container>
    </main>
  );
}
