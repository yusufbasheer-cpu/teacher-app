import { NextResponse } from "next/server";
import { processSchoolEnrollment } from "@/lib/school-enrollment-server";
import { authenticateRequest } from "@/lib/user-usage-server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`auth:ip:${ip}`, 5, FIFTEEN_MIN_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let bodyEmail: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; fromGoogleLogin?: boolean };
    bodyEmail = body.email?.trim();
    console.log("[school-enrollment] API called", {
      userId: auth.userId,
      fromGoogleLogin: body.fromGoogleLogin === true,
      bodyEmail: bodyEmail ?? null,
    });
  } catch {
    /* no body */
  }

  const {
    data: { user },
  } = await auth.supabase.auth.getUser(auth.accessToken);

  if (!user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const userEmail = (bodyEmail ?? user.email ?? "").trim();
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
    schoolId: result.schoolId ?? null,
    planType: result.planType ?? null,
    welcomeMessage: result.welcomeMessage ?? null,
  });
}
