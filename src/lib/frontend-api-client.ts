import "client-only";

import { getAuthHeaders, getAuthOnlyHeaders } from "@/lib/auth-headers";
import { tryParseApiJson, type TryParseApiJsonResult } from "@/lib/try-parse-api-json";

export type FrontendApiAuthMode = "none" | "bearer";

export type FrontendApiRequestInit = Omit<RequestInit, "headers"> & {
  auth?: FrontendApiAuthMode;
  headers?: HeadersInit;
  json?: unknown;
  logLabel?: string;
};

function assertFrontendApiPath(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error("Frontend API client only accepts local /api/ paths.");
  }
  return path;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function buildHeaders(init: FrontendApiRequestInit): Promise<Headers> {
  const baseHeaders = new Headers(init.headers);

  if (init.auth === "bearer") {
    if (init.json !== undefined) {
      return new Headers(await getAuthHeaders(headersToRecord(baseHeaders)));
    }

    const authHeaders = new Headers(await getAuthOnlyHeaders());
    baseHeaders.forEach((value, key) => {
      authHeaders.set(key, value);
    });
    return authHeaders;
  }

  if (init.json !== undefined && !baseHeaders.has("Content-Type")) {
    baseHeaders.set("Content-Type", "application/json");
  }

  return baseHeaders;
}

export async function apiFetch(path: string, init: FrontendApiRequestInit = {}): Promise<Response> {
  const { auth = "none", headers, json, ...requestInit } = init;
  const finalHeaders = await buildHeaders({ ...requestInit, auth, headers, json });

  return fetch(assertFrontendApiPath(path), {
    ...requestInit,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : requestInit.body,
  });
}

export async function apiJson<T>(
  path: string,
  init: FrontendApiRequestInit = {},
): Promise<{ response: Response; parsed: TryParseApiJsonResult<T> }> {
  const response = await apiFetch(path, init);
  const raw = await response.text();
  return {
    response,
    parsed: tryParseApiJson<T>(raw, response.status, init.logLabel),
  };
}

export async function apiText(
  path: string,
  init: FrontendApiRequestInit = {},
): Promise<{ response: Response; text: string }> {
  const response = await apiFetch(path, init);
  return { response, text: await response.text() };
}

export async function apiBlob(
  path: string,
  init: FrontendApiRequestInit = {},
): Promise<{ response: Response; blob: Blob }> {
  const response = await apiFetch(path, init);
  return { response, blob: await response.blob() };
}

