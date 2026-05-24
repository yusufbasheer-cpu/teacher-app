import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { processSchoolEnrollment } from "@/lib/school-enrollment-server";
import { SCHOOL_WELCOME_MESSAGE } from "@/lib/school-accounts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  const userEmail = user?.email?.trim() ?? "";
  if (!userEmail) {
    return NextResponse.json({ error: "No email on account." }, { status: 400 });
  }

  const result = await processSchoolEnrollment(auth.userId, userEmail);

  if (!result.ok) {
    return NextResponse.json(
      { blocked: true, message: result.message },
      { status: 403 },
    );
  }

  return NextResponse.json({
    blocked: false,
    individual: result.individual,
    newlyJoined: result.newlyJoined,
    schoolName: result.schoolName ?? null,
    planType: result.planType ?? null,
    welcomeMessage: result.newlyJoined ? SCHOOL_WELCOME_MESSAGE : null,
  });
}
