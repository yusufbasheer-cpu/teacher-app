/**
 * Pexels image fetching utility for Layah.ai PPT generation.
 *
 * Pexels photo slides (deck indices): 0 Title, 1 Starter, 7 Connection, 8 Plenary, 9 Extended Task.
 */

import { logPexelsEnvStatus, resolvePexelsApiKey } from "@/lib/image-api-env";

const PEXELS_API_BASE = "https://api.pexels.com/v1";

/** The 6 PPT slide types that receive a Pexels image (legacy helper). */
export type PptImageSlot =
  | "title"
  | "starter"
  | "main"
  | "plenary"
  | "differentiated"
  | "extended_task";

/** Deck index for each image slot. */
export const PPT_IMAGE_SLIDE_INDICES: Record<PptImageSlot, number> = {
  title: 0,
  starter: 1,
  main: 5,
  plenary: 8,
  differentiated: 9,
  extended_task: 10,
};

export function buildPexelsSearchRequestUrl(query: string, page: number, perPage = 15): string {
  const params = new URLSearchParams({
    query: query.replace(/\s+/g, " ").trim() || "education",
    per_page: String(perPage),
    page: String(page),
    orientation: "landscape",
  });
  return `${PEXELS_API_BASE}/search?${params.toString()}`;
}

export type PexelsLandscapeFetchOptions = {
  verboseLog?: boolean;
  logLabel?: string;
  /** 1-based slide number for logs (e.g. 1 = title). */
  slideNumber1Based?: number;
};

type PexelsPhotoSrc = { large?: string; medium?: string };
type PexelsPhoto = { src: PexelsPhotoSrc };
type PexelsSearchSuccess = {
  photos: PexelsPhoto[];
  total_results?: number;
  next_page?: string | number;
};
type PexelsSearchResult =
  | { ok: true; status: number; statusText: string; data: PexelsSearchSuccess }
  | { ok: false; status: number; statusText: string; error: string; rawBody?: string };

function safeJsonForLog(value: unknown, maxLen = 12_000): string {
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > maxLen ? `${s.slice(0, maxLen)}… (truncated)` : s;
  } catch {
    return String(value);
  }
}

async function fetchPexelsSearchPage(
  apiKey: string,
  query: string,
  page: number,
  label: string,
): Promise<PexelsSearchResult> {
  const url = buildPexelsSearchRequestUrl(query, page);
  console.log(`[pexels][${label}] → HTTP GET ${url}`);
  console.log(`[pexels][${label}] → Authorization header: <PEXELS_API_KEY> (Pexels uses the raw key, value hidden)`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: apiKey },
      cache: "no-store",
    });
    const rawBody = await res.text();
    console.log(
      `[pexels][${label}] ← HTTP ${res.status} ${res.statusText} | bodyLength=${rawBody.length}`,
    );

    if (!res.ok) {
      console.error(`[pexels][${label}] error response body:\n${rawBody.slice(0, 2000)}`);
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        error: rawBody.slice(0, 500) || res.statusText,
        rawBody,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      console.error(`[pexels][${label}] failed to parse JSON body`);
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        error: "Invalid JSON from Pexels",
        rawBody,
      };
    }

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const errMsg = String((parsed as { error: unknown }).error);
      console.error(`[pexels][${label}] API error field in JSON: ${errMsg}`);
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        error: errMsg,
        rawBody,
      };
    }

    const data = parsed as PexelsSearchSuccess;
    const summary = {
      status: res.status,
      photosReturned: data.photos?.length ?? 0,
      totalResults: data.total_results,
      nextPage: data.next_page,
    };
    console.log(`[pexels][${label}] parsed response summary:`, JSON.stringify(summary));

    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      data: { photos: data.photos ?? [], total_results: data.total_results, next_page: data.next_page },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pexels][${label}] fetch exception:`, msg, e);
    return { ok: false, status: 0, statusText: "FETCH_FAILED", error: msg };
  }
}

/**
 * Search Pexels (landscape) across pages until an unused image URL is found.
 * Uses direct HTTP so every call logs URL + status. Independent of fal.ai.
 */
export async function fetchPexelsUniqueLandscapeUrl(
  query: string,
  usedUrls: Set<string>,
  options?: PexelsLandscapeFetchOptions,
): Promise<string | null> {
  const label = options?.logLabel ?? "pexels";
  const slideHint =
    options?.slideNumber1Based !== undefined ? ` (slide ${options.slideNumber1Based})` : "";

  logPexelsEnvStatus(`fetchPexelsUniqueLandscapeUrl${slideHint}`);

  const apiKey = resolvePexelsApiKey();
  if (!apiKey) {
    console.warn(`[pexels][${label}] SKIPPED — no valid PEXELS_API_KEY (call not sent)`);
    return null;
  }

  console.log(`[pexels][${label}] START Pexels search — query="${query.replace(/\s+/g, " ").trim()}"`);

  const q = query.replace(/\s+/g, " ").trim() || "education";

  try {
    for (let page = 1; page <= 10; page++) {
      const result = await fetchPexelsSearchPage(apiKey, q, page, label);

      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          console.error(
            `[pexels][${label}] Auth failed (HTTP ${result.status}). Verify PEXELS_API_KEY at https://www.pexels.com/api/`,
          );
        }
        break;
      }

      for (const photo of result.data.photos) {
        const url = photo.src?.large ?? photo.src?.medium ?? null;
        if (url && !usedUrls.has(url)) {
          console.log(
            `[pexels][${label}] ✔ SUCCESS — selected image URL for deck (page ${page}): ${url}`,
          );
          return url;
        }
      }

      if (result.data.photos.length > 0 && options?.verboseLog) {
        console.warn(
          `[pexels][${label}] page ${page}: all ${result.data.photos.length} URLs already used in deck — trying next page`,
        );
      }

      if (result.data.photos.length === 0) {
        console.warn(`[pexels][${label}] page ${page}: zero photos in response — stopping paging`);
        break;
      }
    }

    console.warn(`[pexels][${label}] FAILED — no unused landscape image after paging — query: "${q}"`);
    return null;
  } catch (e) {
    console.error(`[pexels][${label}] fetchPexelsUniqueLandscapeUrl exception:`, e);
    return null;
  }
}

export async function fetchPexelsImage(query: string): Promise<string | null> {
  return fetchPexelsUniqueLandscapeUrl(query, new Set(), { verboseLog: true, logLabel: "single-fetch" });
}

export function buildPexelsQuery(
  slot: PptImageSlot,
  topic: string,
  subject: string,
): string {
  const t = topic.trim();
  const s = subject.trim();
  switch (slot) {
    case "title":
      return `${t} ${s}`;
    case "starter":
      return `${t} ${s} discovery curiosity`;
    case "main":
      return `${t} ${s} learning education`;
    case "plenary":
      return `${t} ${s} reflection summary`;
    case "differentiated":
      return `${t} classroom activity teamwork`;
    case "extended_task":
      return `${t} ${s} study research`;
    default:
      return `${t} education`;
  }
}

/** Fetch legacy 6-slot PPT images in parallel. */
export async function fetchPptPexelsImages(
  topic: string,
  subject: string,
  deckSize: number,
): Promise<(string | null)[]> {
  const slots: PptImageSlot[] = [
    "title",
    "starter",
    "main",
    "plenary",
    "differentiated",
    "extended_task",
  ];

  logPexelsEnvStatus("fetchPptPexelsImages");
  console.log(`[pexels] Fetching ${slots.length} PPT images — topic="${topic}", subject="${subject}"`);

  const results = await Promise.allSettled(
    slots.map((slot) => {
      const q = buildPexelsQuery(slot, topic, subject);
      return fetchPexelsImage(q);
    }),
  );

  const urls = results.map((r) => (r.status === "fulfilled" ? r.value : null));
  const deck: (string | null)[] = Array.from({ length: deckSize }, () => null);
  slots.forEach((slot, i) => {
    const idx = PPT_IMAGE_SLIDE_INDICES[slot];
    if (idx < deckSize) deck[idx] = urls[i] ?? null;
  });

  console.log(`[pexels] ${urls.filter(Boolean).length}/${slots.length} images fetched successfully`);
  return deck;
}
