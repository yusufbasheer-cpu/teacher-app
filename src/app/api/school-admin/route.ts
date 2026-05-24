import { NextResponse } from "next/server";
import { getSchoolAdminDashboard } from "@/lib/school-admin-server";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  const email = user?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "No email on account." }, { status: 400 });
  }

  const dashboard = await getSchoolAdminDashboard(email);
  if (!dashboard) {
    return NextResponse.json(
      { error: "You are not authorized to manage a school account." },
      { status: 403 },
    );
  }

  return NextResponse.json(dashboard);
}
