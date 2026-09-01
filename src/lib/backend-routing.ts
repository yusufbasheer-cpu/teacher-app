import "server-only";

export type BackendRouteEndpoint = "geo";
export type BackendRouteTarget = "next" | "python";

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

function getEndpointRouteValue(endpoint: BackendRouteEndpoint): string {
  if (endpoint === "geo") {
    return process.env.BACKEND_ROUTE_GEO?.trim().toLowerCase() ?? "";
  }
  return "";
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

export function buildPythonBackendUrl(baseUrl: URL, path: "/api/geo"): URL {
  return new URL(path, baseUrl);
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
    pythonUrl: buildPythonBackendUrl(baseUrl, "/api/geo"),
    reason: "python_selected",
  };
}
