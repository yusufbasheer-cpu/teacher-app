import { GammaError, type GammaConfig } from "./config";

export type GammaTheme = { id: string; name: string; type: string; colorKeywords: string[]; toneKeywords: string[] };
export type CuratedGammaTheme = GammaTheme & { intent: "Professional classroom" | "Modern educational" | "Visual and engaging"; swatch: "calm" | "modern" | "vivid" };

let cached: { key: string; expiresAt: number; themes: GammaTheme[] } | null = null;
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 12) : [];

export async function listGammaThemes(config: Pick<GammaConfig, "apiKey" | "baseUrl" | "requestTimeoutMs">, fetchImpl: typeof fetch = fetch): Promise<GammaTheme[]> {
  const key = config.baseUrl;
  if (cached?.key === key && cached.expiresAt > Date.now()) return cached.themes;
  const themes: GammaTheme[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${config.baseUrl}/themes`);
    url.searchParams.set("type", "standard");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("after", cursor);
    const response = await fetchImpl(url, { headers: { "X-API-KEY": config.apiKey }, signal: AbortSignal.timeout(config.requestTimeoutMs) });
    if (!response.ok) throw new GammaError(response.status === 401 ? "invalid_credentials" : "api_error", `Gamma theme list failed (HTTP ${response.status}).`);
    const body = await response.json() as unknown;
    const object = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const rows = Array.isArray(body) ? body : Array.isArray(object.data) ? object.data : Array.isArray(object.themes) ? object.themes : [];
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      const type = typeof item.type === "string" ? item.type : "standard";
      if (type !== "standard") continue;
      themes.push({ id: item.id, name: item.name, type, colorKeywords: strings(item.colorKeywords), toneKeywords: strings(item.toneKeywords) });
    }
    const next = object.nextCursor ?? object.nextPageToken ?? object.after;
    cursor = typeof next === "string" && next ? next : undefined;
    if (!cursor || rows.length === 0) break;
  }
  cached = { key, expiresAt: Date.now() + 6 * 60 * 60_000, themes };
  return themes;
}

export function curateGammaThemes(themes: GammaTheme[]): CuratedGammaTheme[] {
  const intents: Array<{ intent: CuratedGammaTheme["intent"]; swatch: CuratedGammaTheme["swatch"]; terms: string[] }> = [
    { intent: "Professional classroom", swatch: "calm", terms: ["professional", "minimal", "clean", "calm"] },
    { intent: "Modern educational", swatch: "modern", terms: ["modern", "educational", "friendly", "fresh"] },
    { intent: "Visual and engaging", swatch: "vivid", terms: ["colorful", "vibrant", "bold", "playful", "engaging"] },
  ];
  const unused = [...themes];
  return intents.flatMap(({ intent, swatch, terms }) => {
    if (!unused.length) return [];
    const score = (theme: GammaTheme) => [...theme.toneKeywords, ...theme.colorKeywords, theme.name].join(" ").toLowerCase().split(/\W+/).filter((word) => terms.includes(word)).length;
    const selected = unused.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0]!;
    unused.splice(unused.indexOf(selected), 1);
    return [{ ...selected, intent, swatch }];
  });
}

export function validateGammaPresentationOptions(input: { themeId?: unknown; imageSource?: unknown; imageStyle?: unknown }, themes: GammaTheme[]) {
  const themeId = typeof input.themeId === "string" ? input.themeId.trim() : "";
  if (themeId && !themes.some((theme) => theme.id === themeId)) throw new GammaError("bad_request", "The selected Gamma theme is not available in this workspace.");
  const allowedSources = new Set(["aiGenerated", "pexels", "webFreeToUse", "webFreeToUseCommercially", "themeAccent", "noImages"]);
  const imageSource = typeof input.imageSource === "string" && allowedSources.has(input.imageSource) ? input.imageSource : "aiGenerated";
  const imageStyle = typeof input.imageStyle === "string" ? input.imageStyle.trim().slice(0, 500) : "";
  return { themeId: themeId || undefined, imageSource, imageStyle: imageSource === "aiGenerated" ? imageStyle || undefined : undefined };
}
