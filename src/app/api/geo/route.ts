import { NextRequest, NextResponse } from "next/server";
import { resolveBackendRoute } from "@/lib/backend-routing";
import { resolveGeoLocation } from "@/lib/geo-service";

export const GEO_PYTHON_PROXY_TIMEOUT_MS = 9000;

function buildGeoProxyHeaders(incoming: Headers): Headers {
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["x-vercel-ip-country", "x-forwarded-for", "x-real-ip"]) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxyGeoToPython(url: URL, headers: Headers): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEO_PYTHON_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: buildGeoProxyHeaders(headers),
      signal: controller.signal,
      cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type");
    const responseHeaders = new Headers();
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

export async function GET(request: NextRequest) {
  const decision = resolveBackendRoute("geo");

  if (decision.target === "python" && decision.pythonUrl) {
    try {
      console.log("[backend-routing] Routing endpoint", {
        endpoint: "geo",
        backend: "python",
        fallback: false,
      });
      return await proxyGeoToPython(decision.pythonUrl, request.headers);
    } catch (err) {
      console.warn("[backend-routing] Python geo transport failed; falling back to Next", {
        endpoint: "geo",
        backend: "next",
        fallback: true,
        failure: err instanceof Error ? err.name : "unknown",
      });
    }
  } else {
    console.log("[backend-routing] Routing endpoint", {
      endpoint: "geo",
      backend: "next",
      fallback: false,
      reason: decision.reason,
    });
  }

  return NextResponse.json(await resolveGeoLocation(request.headers));
}
