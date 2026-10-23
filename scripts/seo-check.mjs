// Smoke-checks the SEO basics of a running site.
//   node scripts/seo-check.mjs http://localhost:3055
//   node scripts/seo-check.mjs https://www.layah.in
// Exits 1 if any check fails. Canonicals are expected on the production host
// regardless of the base URL being tested.
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const CANON = "https://www.layah.in";
const PAGES = ["/", "/pricing", "/about", "/faq", "/contact", "/privacy", "/terms", "/blog"];

let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed++;
};
const get = (p, init) => fetch(BASE + p, { redirect: "manual", ...init });

const titles = new Map();
const descs = new Map();
for (const p of PAGES) {
  const res = await get(p);
  const html = await res.text();
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  check(res.status === 200, `${p} returns 200`);
  check(h1s === 1, `${p} has exactly one <h1> in the initial HTML (found ${h1s})`);
  check(canon === (p === "/" ? CANON : CANON + p), `${p} canonical is ${canon}`);
  check(!!title && !!desc, `${p} has title and description`);
  check(html.includes('property="og:image"') && html.includes('name="twitter:image"'), `${p} has og:image and twitter:image`);
  check(html.includes('"@type":"Organization"'), `${p} carries Organization JSON-LD`);
  if (p !== "/") check(html.includes('"BreadcrumbList"'), `${p} carries BreadcrumbList JSON-LD`);
  titles.set(title, (titles.get(title) ?? 0) + 1);
  descs.set(desc, (descs.get(desc) ?? 0) + 1);
}
check([...titles.values()].every((n) => n === 1), "page titles are unique");
check([...descs.values()].every((n) => n === 1), "meta descriptions are unique");

const robots = await (await get("/robots.txt")).text();
check(robots.includes(`Sitemap: ${CANON}/sitemap.xml`), "robots.txt references the www sitemap");
check(!/^Disallow: \/\s*$/m.test(robots), "robots.txt does not block the whole site (expected for production)");

const sitemap = await (await get("/sitemap.xml")).text();
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(locs.length > 0 && locs.every((l) => l.startsWith(CANON)), "sitemap URLs are all absolute www URLs");
check(new Set(locs).size === locs.length, "sitemap has no duplicate URLs");
for (const l of locs) {
  const r = await get(l.replace(CANON, ""));
  if (r.status !== 200) check(false, `sitemap URL ${l} returned ${r.status}`);
}

const nf = await get("/definitely-not-a-page");
check(nf.status === 404, "unknown path returns 404");
const land = await get("/landing");
check([301, 308].includes(land.status) && land.headers.get("location") === "/", "/landing permanently redirects to /");
const og = await get("/og-image.png");
check(og.status === 200 && og.headers.get("content-type") === "image/png", "/og-image.png is served");

const empty = await get("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
check(empty.status === 400, `contact API rejects an empty body (got ${empty.status})`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
