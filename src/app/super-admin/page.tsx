import { redirect } from "next/navigation";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import { SuperAdminPinGate } from "@/components/admin/super-admin-pin-gate";
import { isAdminUser } from "@/lib/super-admin";
import { getVerifiedUser } from "@/lib/verified-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SuperAdminPage() {
  const user = await getVerifiedUser();

  if (!user?.email) {
    redirect("/login");
  }

  // DB-driven: any admin_roles row (super_admin or the narrower admin
  // role) may reach this page. No email pre-filter here — a future
  // narrower-role hire won't be in the hardcoded founder allowlist.
  const role = await isAdminUser(user.id);
  if (!role) {
    redirect("/dashboard?access_denied=1");
  }

  return (
    <SuperAdminPinGate>
      <SuperAdminDashboard role={role} email={user.email} />
    </SuperAdminPinGate>
  );
}
