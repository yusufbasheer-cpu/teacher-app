import { redirect } from "next/navigation";
import { SchoolAdminDashboard } from "@/components/school/school-admin-dashboard";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import { getSchoolAdminDashboard } from "@/lib/school-admin-server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";

export default async function SchoolAdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/auth");
  }

  console.log("[school-admin page] logged-in user email:", user.email);
  console.log("[school-admin page] user id:", user.id);

  const dashboard = await getSchoolAdminDashboard(user.email);

  if (!dashboard) {
    console.log(
      "[school-admin page] access denied — no dashboard for",
      JSON.stringify(user.email),
    );
    redirect("/dashboard?admin_denied=1");
  }

  return (
    <main className="min-h-screen pb-16 pt-10" style={{ background: "#F7F9FC" }}>
      <Container>
        <FadeIn>
          <SchoolAdminDashboard initialData={dashboard} />
        </FadeIn>
      </Container>
    </main>
  );
}
