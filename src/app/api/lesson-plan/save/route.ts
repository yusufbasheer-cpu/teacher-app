import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-client-error";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { saveLessonPlanRecord, isValidLessonPlanSaveRequestBody } from "@/lib/lesson-plan-save";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return apiErrorResponse(authError.message, 500, "lesson-plan/save");
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!isValidLessonPlanSaveRequestBody(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await saveLessonPlanRecord(supabase, user.id, body);
    return NextResponse.json(result, { status: result.action === "inserted" ? 201 : 200 });
  } catch (err) {
    return apiErrorResponse(err instanceof Error ? err.message : String(err), 500, "lesson-plan/save");
  }
}

