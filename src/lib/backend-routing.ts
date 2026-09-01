import "server-only";

export type BackendRouteEndpoint = "geo" | "verify-captcha";
export type BackendRouteTarget = "next" | "python";
type BackendRouteUpstreamPath = "/api/geo" | "/api/auth/verify-captcha";

export type BackendRouteDecision = {
  endpoint: BackendRouteEndpoint;
  target: BackendRouteTarget;
  pythonUrl: URL | null;
  reason:
    | "default_next"
    | "explicit_next"
    | "unknown_route_value"
    | "python_selected"
    | "missing_python_url"
    | "invalid_python_url";
};

const PYTHON_ROUTE_VALUE = "python";
const NEXT_ROUTE_VALUE = "next";

// Fixed, server-controlled allowlist. Adding an endpoint here is the only
// way to make it eligible for Python routing — there is no client input
// path that can select or extend this mapping.
const ENDPOINT_ROUTE_ENV_VAR: Record<BackendRouteEndpoint, string> = {
  geo: "BACKEND_ROUTE_GEO",
  "verify-captcha": "BACKEND_ROUTE_VERIFY_CAPTCHA",
};

const ENDPOINT_UPSTREAM_PATH: Record<BackendRouteEndpoint, BackendRouteUpstreamPath> = {
  geo: "/api/geo",
  "verify-captcha": "/api/auth/verify-captcha",
};

function getEndpointRouteValue(endpoint: BackendRouteEndpoint): string {
  return process.env[ENDPOINT_ROUTE_ENV_VAR[endpoint]]?.trim().toLowerCase() ?? "";
}

export function resolvePythonBackendBaseUrl(): URL | null {
  const raw = process.env.PYTHON_BACKEND_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function buildPythonBackendUrl(baseUrl: URL, path: BackendRouteUpstreamPath): URL {
  return new URL(path, baseUrl);
}

// Vercel Preview deployments are protected (SSO/Deployment Protection) by
// default. This attaches Vercel's own documented "Protection Bypass for
// Automation" header so a server-to-server proxy call can reach a
// protection-gated backend Preview during testing. No-op — and therefore
// harmless in production — unless PYTHON_BACKEND_BYPASS_SECRET is
// explicitly configured. This is unrelated to, and does not affect,
// Authorization/Cookie forwarding decisions.
export function applyDeploymentProtectionBypass(headers: Headers): void {
  const bypassSecret = process.env.PYTHON_BACKEND_BYPASS_SECRET?.trim();
  if (bypassSecret) {
    headers.set("x-vercel-protection-bypass", bypassSecret);
  }
}

export function resolveBackendRoute(endpoint: BackendRouteEndpoint): BackendRouteDecision {
  const routeValue = getEndpointRouteValue(endpoint);

  if (!routeValue) {
    return { endpoint, target: "next", pythonUrl: null, reason: "default_next" };
  }

  if (routeValue === NEXT_ROUTE_VALUE) {
    return { endpoint, target: "next", pythonUrl: null, reason: "explicit_next" };
  }

  if (routeValue !== PYTHON_ROUTE_VALUE) {
    console.warn("[backend-routing] Unknown backend route value; using Next", { endpoint });
    return { endpoint, target: "next", pythonUrl: null, reason: "unknown_route_value" };
  }

  const rawPythonBackendUrl = process.env.PYTHON_BACKEND_URL?.trim();
  if (!rawPythonBackendUrl) {
    console.warn("[backend-routing] Python selected without a valid backend URL; using Next", {
      endpoint,
    });
    return { endpoint, target: "next", pythonUrl: null, reason: "missing_python_url" };
  }

  const baseUrl = resolvePythonBackendBaseUrl();
  if (!baseUrl) {
    console.warn("[backend-routing] Python selected with an invalid backend URL; using Next", {
      endpoint,
    });
    return { endpoint, target: "next", pythonUrl: null, reason: "invalid_python_url" };
  }

  return {
    endpoint,
    target: "python",
    pythonUrl: buildPythonBackendUrl(baseUrl, ENDPOINT_UPSTREAM_PATH[endpoint]),
    reason: "python_selected",
  };
}
