import { NextResponse } from "next/server";
import { applyDeploymentProtectionBypass, resolveBackendRoute } from "@/lib/backend-routing";
import { defaultFreeUsageSnapshot, getUpgradePitch } from "@/lib/user-usage";
import { authenticateRequest, getOrCreateUserUsage } from "@/lib/user-usage-server";

export const runtime = "nodejs";
export const USER_USAGE_PYTHON_PROXY_TIMEOUT_MS = 10000;

function buildUserUsageProxyHeaders(incoming: Headers): Headers {
  const headers = new Headers({ Accept: "application/json" });
  const authorization = incoming.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  applyDeploymentProtectionBypass(headers);
  return headers;
}

async function proxyUserUsageToPython(url: URL, headers: Headers): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USER_USAGE_PYTHON_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: buildUserUsageProxyHeaders(headers),
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

export async function GET(req: Request) {
  const decision = resolveBackendRoute("user-usage");
  if (decision.target === "python" && decision.pythonUrl) {
    try {
      console.log("[backend-routing] Routing endpoint", {
        endpoint: "user-usage",
        backend: "python",
        fallback: false,
      });
      return await proxyUserUsageToPython(decision.pythonUrl, req.headers);
    } catch (err) {
      console.error("[backend-routing] Python user-usage transport failed; no fallback", {
        endpoint: "user-usage",
        backend: "python",
        fallback: false,
        failure: err instanceof Error ? err.name : "unknown",
      });
      return NextResponse.json(
        { error: "User usage is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const usage = await getOrCreateUserUsage(auth.supabase, auth.userId);
  const resolved = usage ?? defaultFreeUsageSnapshot();

  if (!usage) {
    console.warn("[user-usage] GET /api/user-usage: using fallback snapshot (fail-open)", {
      userId: auth.userId,
    });
  }

  const pitch = getUpgradePitch(resolved.planType);

  return NextResponse.json({
    usage: resolved,
    upgradePitch: pitch,
  });
}
