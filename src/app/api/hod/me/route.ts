import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { getHodTeacherRow } from "@/lib/hod-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ isHod: false, department: null });
  }

  const hodRow = await getHodTeacherRow(auth.userId);
  return NextResponse.json({
    isHod: Boolean(hodRow),
    department: hodRow?.department ?? null,
  });
}
