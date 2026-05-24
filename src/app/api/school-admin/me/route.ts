import { NextResponse } from "next/server";
import { isUserSchoolAdmin } from "@/lib/school-admin-server";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

/** Returns whether the logged-in user is a school admin (for nav). */
export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  const email = user?.email?.trim() ?? "";
  if (!email) {
    return NextResponse.json({ isAdmin: false });
  }

  const isAdmin = await isUserSchoolAdmin(email, auth.supabase);
  return NextResponse.json({ isAdmin });
}
