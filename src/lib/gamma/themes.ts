import { GammaError, type GammaConfig } from "./config";

export type GammaTheme = { id: string; name: string; type: string; colorKeywords: string[]; toneKeywords: string[] };
/** A theme as shown in the picker: Gamma's metadata plus up to three preview colours derived from its colour keywords. */
export type CuratedGammaTheme = GammaTheme & { swatch: string[] };

let cached: { key: string; expiresAt: number; themes: GammaTheme[] } | null = null;
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 12) : [];

/** Gamma's documented page-size maximum for GET /themes. A larger value is rejected, which used to empty the picker. */
const PAGE_LIMIT = 50;

async function listThemesOfType(
  type: "standard" | "custom",
  config: Pick<GammaConfig, "apiKey" | "baseUrl" | "requestTimeoutMs">,
  fetchImpl: typeof fetch,
): Promise<GammaTheme[]> {
  const themes: GammaTheme[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${config.baseUrl}/themes`);
    url.searchParams.set("type", type);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (cursor) url.searchParams.set("after", cursor);
    const response = await fetchImpl(url, { headers: { "X-API-KEY": config.apiKey }, signal: AbortSignal.timeout(config.requestTimeoutMs) });
    if (!response.ok) throw new GammaError(response.status === 401 ? "invalid_credentials" : "api_error", `Gamma theme list failed (HTTP ${response.status}).`);
    const body = await response.json() as unknown;
    const object = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const rows = Array.isArray(body) ? body : Array.isArray(object.data) ? object.data : [];
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      themes.push({ id: item.id, name: item.name, type: typeof item.type === "string" ? item.type : type, colorKeywords: strings(item.colorKeywords), toneKeywords: strings(item.toneKeywords) });
    }
    const next = object.nextCursor;
    cursor = object.hasMore !== false && typeof next === "string" && next ? next : undefined;
    if (!cursor || rows.length === 0) break;
  }
  return themes;
}

/** Workspace (custom) themes first, then Gamma's built-in themes. A failing custom list never hides the built-in ones. */
export async function listGammaThemes(config: Pick<GammaConfig, "apiKey" | "baseUrl" | "requestTimeoutMs">, fetchImpl: typeof fetch = fetch): Promise<GammaTheme[]> {
  const key = config.baseUrl;
  if (cached?.key === key && cached.expiresAt > Date.now()) return cached.themes;
  const [custom, standard] = await Promise.all([
    listThemesOfType("custom", config, fetchImpl).catch(() => [] as GammaTheme[]),
    listThemesOfType("standard", config, fetchImpl),
  ]);
  const seen = new Set<string>();
  const themes = [...custom, ...standard].filter((t) => !seen.has(t.id) && seen.add(t.id));
  cached = { key, expiresAt: Date.now() + 6 * 60 * 60_000, themes };
  return themes;
}

const COLOR_WORDS: Record<string, string> = {
  white: "#ffffff", cream: "#f6f0e1", beige: "#e8dcc4", ivory: "#fbf8ef", gray: "#9aa0a6", grey: "#9aa0a6", silver: "#c0c4c8",
  black: "#1c1c1c", dark: "#24272b", charcoal: "#36393d", navy: "#1f2f5a", blue: "#3b6fd8", sky: "#7cc4f0", teal: "#2a9d8f",
  turquoise: "#36c2c2", cyan: "#3cc6dc", green: "#3f9f5a", mint: "#a8e6cf", olive: "#7a8a3a", emerald: "#1f9d6b", sage: "#9cb39b",
  yellow: "#f2c94c", gold: "#c9a227", orange: "#f2994a", coral: "#f47c6c", peach: "#f7c3a3", red: "#d64545", pink: "#f28fb2",
  rose: "#e47a95", magenta: "#c2389e", purple: "#7b4fc9", violet: "#8a5cf6", lavender: "#c9b8f0", indigo: "#4b4fc4",
  brown: "#8b5e3c", tan: "#d2b48c", pastel: "#f3d9e8", neon: "#39ff88",
};

function swatchFor(theme: GammaTheme): string[] {
  const colours = theme.colorKeywords
    .flatMap((k) => k.toLowerCase().split(/[^a-z]+/))
    .map((w) => COLOR_WORDS[w])
    .filter((c): c is string => Boolean(c));
  return [...new Set(colours)].slice(0, 3);
}

/** Classroom-suited tone words rank a theme higher; nothing is hidden, only ordered. */
const CLASSROOM_TERMS = ["educational", "friendly", "clean", "modern", "fresh", "playful", "bright", "calm", "professional", "minimal", "colorful", "vibrant", "warm"];

export function curateGammaThemes(themes: GammaTheme[], limit = 40): CuratedGammaTheme[] {
  const score = (t: GammaTheme) =>
    (t.type === "custom" ? 100 : 0) +
    [...t.toneKeywords, ...t.colorKeywords, t.name].join(" ").toLowerCase().split(/\W+/).filter((w) => CLASSROOM_TERMS.includes(w)).length;
  return [...themes]
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((t) => ({ ...t, swatch: swatchFor(t) }));
}

export function validateGammaPresentationOptions(input: { themeId?: unknown; imageSource?: unknown; imageStyle?: unknown }, themes: GammaTheme[]) {
  const themeId = typeof input.themeId === "string" ? input.themeId.trim() : "";
  if (themeId && !themes.some((theme) => theme.id === themeId)) throw new GammaError("bad_request", "The selected Gamma theme is not available in this workspace.");
  const allowedSources = new Set(["aiGenerated", "pexels", "webFreeToUse", "webFreeToUseCommercially", "themeAccent", "noImages"]);
  const imageSource = typeof input.imageSource === "string" && allowedSources.has(input.imageSource) ? input.imageSource : "aiGenerated";
  const imageStyle = typeof input.imageStyle === "string" ? input.imageStyle.trim().slice(0, 500) : "";
  return { themeId: themeId || undefined, imageSource, imageStyle: imageSource === "aiGenerated" ? imageStyle || undefined : undefined };
}
