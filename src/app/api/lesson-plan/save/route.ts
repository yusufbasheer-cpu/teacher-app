import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-client-error";
import { applyDeploymentProtectionBypass, resolveBackendRoute } from "@/lib/backend-routing";
import { createServerSupabaseClient } from "@/lib/supabase-ssr";
import { saveLessonPlanRecord, isValidLessonPlanSaveRequestBody } from "@/lib/lesson-plan-save";

export const runtime = "nodejs";
export const LESSON_PLAN_SAVE_PYTHON_PROXY_TIMEOUT_MS = 10000;

function buildLessonPlanSaveProxyHeaders(incoming: Headers): Headers {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
  const authorization = incoming.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  applyDeploymentProtectionBypass(headers);
  return headers;
}

async function proxyLessonPlanSaveToPython(
  url: URL,
  headers: Headers,
  rawBody: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LESSON_PLAN_SAVE_PYTHON_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: buildLessonPlanSaveProxyHeaders(headers),
      body: rawBody,
      signal: controller.signal,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const decision = resolveBackendRoute("lesson-plan-save");
  if (decision.target === "python" && decision.pythonUrl) {
    const rawBody = await req.text();
    try {
      console.log("[backend-routing] Routing endpoint", {
        endpoint: "lesson-plan-save",
        backend: "python",
        fallback: false,
      });
      return await proxyLessonPlanSaveToPython(decision.pythonUrl, req.headers, rawBody);
    } catch (err) {
      console.error("[backend-routing] Python lesson-plan-save transport failed; no fallback", {
        endpoint: "lesson-plan-save",
        backend: "python",
        fallback: false,
        failure: err instanceof Error ? err.name : "unknown",
      });
      return NextResponse.json(
        { error: "Lesson plan saving is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
  }

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
