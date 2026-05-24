import { NextResponse } from "next/server";
import { buildSchoolWelcomeMessage } from "@/lib/school-accounts";
import {
  isGoogleAuthUser,
  processSchoolEnrollment,
} from "@/lib/school-enrollment-server";
import { authenticateRequest } from "@/lib/user-usage-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  if (!user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const userEmail = user.email?.trim() ?? "";
  if (!userEmail) {
    return NextResponse.json({ error: "No email on account." }, { status: 400 });
  }

  const googleOnly = isGoogleAuthUser(user);
  const result = await processSchoolEnrollment(auth.userId, userEmail, { googleOnly });

  if (!result.ok) {
    return NextResponse.json(
      { blocked: true, message: result.message },
      { status: 403 },
    );
  }

  const welcomeMessage =
    !result.individual && result.schoolName
      ? buildSchoolWelcomeMessage(result.schoolName)
      : null;

  return NextResponse.json({
    blocked: false,
    individual: result.individual,
    newlyJoined: result.newlyJoined,
    schoolName: result.schoolName ?? null,
    planType: result.planType ?? null,
    welcomeMessage,
  });
}
