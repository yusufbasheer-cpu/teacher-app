import { NextResponse } from "next/server";
import { authenticateRequest, getSupabaseForUser } from "@/lib/user-usage-server";
import { checkRateLimit, getClientIp, rateLimitResponse, HOUR_MS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(`export:ip:${ip}`, 5, HOUR_MS);
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.resetInSeconds);

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const client = getSupabaseForUser(auth.accessToken);

  const [authUser, usageResult, lessonPlansResult] = await Promise.all([
    client.auth.getUser(),
    client
      .from("user_usage")
      .select("plan_type, generations_used, generations_limit, reset_date, created_at")
      .eq("user_id", auth.userId)
      .maybeSingle(),
    client
      .from("lesson_plans")
      .select("id, subject, grade, curriculum_type, curriculum_framework, topic, learning_objectives, lesson_plan, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false }),
  ]);

  const user = authUser.data.user;
  const usage = usageResult.data;
  const lessonPlans = lessonPlansResult.data ?? [];

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      email: user?.email ?? null,
      created_at: user?.created_at ?? null,
      last_sign_in: user?.last_sign_in_at ?? null,
      auth_provider: user?.app_metadata?.provider ?? "email",
    },
    usage: usage
      ? {
          plan_type: usage.plan_type,
          generations_used: usage.generations_used,
          generations_limit: usage.generations_limit === -1 ? "unlimited" : usage.generations_limit,
          reset_date: usage.reset_date,
          member_since: usage.created_at,
        }
      : null,
    lesson_plans: lessonPlans.map((lp) => ({
      id: lp.id,
      subject: lp.subject,
      grade: lp.grade,
      curriculum_type: lp.curriculum_type,
      curriculum_framework: lp.curriculum_framework,
      topic: lp.topic,
      learning_objectives: lp.learning_objectives,
      content: lp.lesson_plan,
      created_at: lp.created_at,
    })),
    summary: {
      total_lesson_plans: lessonPlans.length,
    },
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="layah-my-data.json"',
    },
  });
}
