import { NextResponse } from "next/server";
import { removeTeacherFromSchool, updateTeacherRoleInSchool } from "@/lib/school-admin-server";
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

  const result = await removeTeacherFromSchool(email, teacherUserId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { userId: teacherUserId } = await context.params;
  if (!teacherUserId) {
    return NextResponse.json({ error: "Missing teacher id." }, { status: 400 });
  }

  let body: { role?: string; department?: string | null };
  try {
    body = (await req.json()) as { role?: string; department?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { role, department } = body;
  if (!role || !["teacher", "hod", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  const email = user?.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "No email on account." }, { status: 400 });
  }

  const result = await updateTeacherRoleInSchool(
    email,
    teacherUserId,
    role as "teacher" | "hod" | "admin",
    department ?? null,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
