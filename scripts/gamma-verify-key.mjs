#!/usr/bin/env node
// Verifies GAMMA_API_KEY with Gamma's documented read-only "list themes" endpoint (GET /v1.0/themes).
// It creates no generation. Gamma's docs do not state whether this call consumes credits; it is a read of workspace metadata.
// The key is read from the environment only, and is never printed.
const key = process.env.GAMMA_API_KEY?.trim();
if (!key) {
  console.error("GAMMA_API_KEY is not set in this environment. Set it in your shell, not in chat or in a committed file.");
  process.exit(2);
}
const base = (process.env.GAMMA_API_BASE_URL?.trim() || "https://public-api.gamma.app/v1.0").replace(/\/$/, "");
try {
  const res = await fetch(`${base}/themes?limit=50`, { headers: { "X-API-KEY": key }, signal: AbortSignal.timeout(20_000) });
  const rate = ["x-ratelimit-remaining-burst", "x-ratelimit-remaining", "x-ratelimit-remaining-daily"]
    .map((h) => `${h}=${res.headers.get(h) ?? "n/a"}`)
    .join(" ");
  console.log(`HTTP ${res.status}  ${rate}`);
  if (res.status === 401) {
    console.error("Gamma rejected the key (401). Check that it is a workspace API key on a plan with API access.");
    process.exit(1);
  }
  if (res.status === 403) {
    console.error("Gamma denied access (403): API access may require Pro/Ultra/Teams/Business/Enterprise, or API keys may be disabled by a workspace admin.");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Unexpected response (${res.status}).`);
    process.exit(1);
  }
  const body = await res.json();
  const themes = Array.isArray(body.data) ? body.data : [];
  console.log(`Key accepted. ${themes.length} theme(s) returned (hasMore=${body.hasMore}).`);
  for (const t of themes) console.log(`  ${t.id}  ${t.name}  [${t.type}]  colors=${(t.colorKeywords ?? []).join("/")}  tone=${(t.toneKeywords ?? []).join("/")}`);
} catch (e) {
  console.error(`Request failed: ${e?.name ?? "error"}`);
  process.exit(1);
}
