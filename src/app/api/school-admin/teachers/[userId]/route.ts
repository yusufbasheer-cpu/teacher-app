import { NextResponse } from "next/server";
import { removeTeacherFromSchool } from "@/lib/school-admin-server";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { userId: teacherUserId } = await context.params;
  if (!teacherUserId) {
    return NextResponse.json({ error: "Missing teacher id." }, { status: 400 });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  const email = user?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "No email on account." }, { status: 400 });
  }

  const result = await removeTeacherFromSchool(email, teacherUserId, auth.supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
