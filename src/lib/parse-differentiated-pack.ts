import {
  DIFF_PACK_KEYS,
  DIFF_PACK_MARKERS,
  type DifferentiatedPackContent,
  emptyDifferentiatedPack,
} from "@/lib/differentiated-pack-markers";

function extractBetweenMarkers(text: string, startMarker: string, endMarker: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const si = normalized.indexOf(startMarker);
  if (si === -1) return "";
  const afterStart = normalized.slice(si + startMarker.length).replace(/^\s*\n/, "");
  const ei = afterStart.indexOf(endMarker);
  if (ei === -1) return afterStart.trim();
  return afterStart.slice(0, ei).trim();
}

export function parseDifferentiatedPack(raw: string): DifferentiatedPackContent {
  const out = emptyDifferentiatedPack();
  const text = raw?.trim() ?? "";
  if (!text) return out;

  for (const key of DIFF_PACK_KEYS) {
    const [start, end] = DIFF_PACK_MARKERS[key];
    out[key] = extractBetweenMarkers(text, start, end);
  }
  return out;
}

export function countFilledPackSections(pack: DifferentiatedPackContent): number {
  return DIFF_PACK_KEYS.filter((k) => (pack[k]?.trim().length ?? 0) > 0).length;
}
