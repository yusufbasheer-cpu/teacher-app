import { redirect } from "next/navigation";
import { SchoolAdminDashboard } from "@/components/school/school-admin-dashboard";
import { Container } from "@/components/ui/container";
import { FadeIn } from "@/components/ui/animate";
import {
  findSchoolForAdmin,
  getSchoolAdminDashboard,
  type SchoolAdminDashboardData,
} from "@/lib/school-admin-server";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Set SCHOOL_ADMIN_BYPASS_AUTH=1 to load the page for any logged-in user (local debugging). */
function isAdminBypassEnabled(): boolean {
  return process.env.SCHOOL_ADMIN_BYPASS_AUTH === "1";
}

function bypassPlaceholderDashboard(email: string): SchoolAdminDashboardData {
  return {
    school: {
      id: "bypass",
      name: "Bypass mode (no school row)",
      planType: "school_starter",
      emailDomain: email.split("@")[1] ?? "unknown",
      maxTeachers: 0,
      activeTeachers: 0,
      adminEmail: email,
    },
    teachers: [],
    usage: {
      totalGenerationsUsedThisMonth: 0,
      mostActiveTeacher: null,
    },
  };
}

export default async function SchoolAdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const bypass = isAdminBypassEnabled();
  const school = await findSchoolForAdmin(user.email);

  if (!school && !bypass) {
    console.error(
      "[school-admin page] access denied: no school_accounts row for admin",
      user.email,
    );
    redirect("/dashboard?admin_denied=1");
  }

  const dashboard = school
    ? await getSchoolAdminDashboard(user.email, school)
    : bypass
      ? bypassPlaceholderDashboard(user.email)
      : null;

  if (!dashboard) {
    console.error(
      "[school-admin page] access denied: school found but dashboard build returned null",
      user.email,
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
