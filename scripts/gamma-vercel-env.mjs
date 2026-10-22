#!/usr/bin/env node
// Branch-scoped Vercel Preview configuration for the Gamma experiment. Everything is scoped to ONE git branch, so no other
// preview, staging.layah.in or Production is affected. Default is a DRY RUN that only prints the plan.
//
//   node scripts/gamma-vercel-env.mjs --tester-email you@example.com            dry run (prints every operation)
//   node scripts/gamma-vercel-env.mjs --tester-email you@example.com --apply     writes the variables
//   node scripts/gamma-vercel-env.mjs --verify                                   checks names only (never values)
//
// Secret values (staging Supabase keys) are read from the Supabase CLI and piped to `vercel env add` on stdin: never printed, never written to disk.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BRANCH = "experiment/gamma-ppt-integration";
const SCOPE = "teacher-app";
const PROJECT_ID = "prj_evS8AChRJBl5N7nY7ZO5ItrBLhg1"; // project-scquo
const STAGING_REF = "esqnyktumxscyvznftlc"; // layah-staging
const PROD_REF = "jbwevzvtloahjoamwnjt";
// Vercel's stable per-branch alias. Verify with `vercel inspect <deployment>` after the first build.
const BRANCH_URL = "https://project-scquo-git-experiment-gamma-ppt-integration-teacher-app.vercel.app";
const DISABLED = "disabled-on-gamma-experiment";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const tester = opt("--tester-email");

/** kind: literal (value shown), secret (hidden), staging-* (fetched from the staging project, hidden) */
const PLAN = [
  // ── 1. Isolation: staging database instead of production ──
  { name: "NEXT_PUBLIC_SUPABASE_URL", kind: "staging-url", why: "use layah-staging, not production" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", kind: "staging-anon", why: "staging anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", kind: "staging-service", sensitive: true, why: "staging service-role key (the Gamma ledger uses it)" },
  // ── 2. Isolation: no live payments from this branch ──
  { name: "RAZORPAY_KEY_ID", kind: "literal", value: DISABLED, sensitive: true, why: "neutralise live Razorpay keys inherited by every Preview" },
  { name: "RAZORPAY_KEY_SECRET", kind: "literal", value: DISABLED, sensitive: true, why: "same" },
  { name: "RAZORPAY_WEBHOOK_SECRET", kind: "literal", value: DISABLED, sensitive: true, why: "same" },
  { name: "RAZORPAY_PRO_PLAN_ID", kind: "literal", value: DISABLED, sensitive: true, why: "same" },
  // ── 3. Browser origin allowlist (src/lib/csrf.ts, src/proxy.ts accept only layah.in, localhost, or exactly this) ──
  { name: "NEXT_PUBLIC_SITE_URL", kind: "literal", value: BRANCH_URL, why: "without it every browser POST from the preview is blocked (403 CSRF)" },
  // ── 4. Gamma gate and default renderer ──
  { name: "GAMMA_EXPERIMENT_ENABLED", kind: "literal", value: "true", why: "gate" },
  { name: "GAMMA_ENVIRONMENT_NAME", kind: "literal", value: "staging", why: "explicit server identity (never production)" },
  { name: "GAMMA_ALLOWED_ENVIRONMENTS", kind: "literal", value: "staging", why: "allowlist" },
  { name: "GAMMA_ALLOWED_SUPABASE_REFS", kind: "literal", value: STAGING_REF, why: "safety net: Gamma refuses to run unless the server's Supabase project is exactly this (and never production), even if an env override fails" },
  { name: "GAMMA_TESTER_EMAILS", kind: "literal", value: tester ?? "<--tester-email required for --apply>", why: "only these accounts can use Gamma" },
  { name: "PPT_GENERATION_PROVIDER", kind: "literal", value: "gamma", why: "Gamma is the default PPT renderer for those testers" },
  { name: "NEXT_PUBLIC_GAMMA_EXPERIMENT", kind: "literal", value: "true", why: "build-time: UI asks the server whether Gamma is available" },
  // ── 5. Pilot cost controls ──
  { name: "GAMMA_EXPORT_HOST_ALLOWLIST", kind: "literal", value: "pending-verification.invalid", why: "matches nothing: first paid smoke test names the real host; paid generation stays resumable" },
  { name: "GAMMA_USER_HOURLY_LIMIT", kind: "literal", value: "2", why: "conservative" },
  { name: "GAMMA_USER_DAILY_LIMIT", kind: "literal", value: "4", why: "conservative" },
  { name: "GAMMA_DAILY_CREDIT_BUDGET", kind: "literal", value: "600", why: "small pilot (each admitted run is charged the estimate below)" },
  { name: "GAMMA_MONTHLY_CREDIT_BUDGET", kind: "literal", value: "1500", why: "small pilot" },
  { name: "GAMMA_MAX_CARDS_PER_RUN", kind: "literal", value: "25", why: "deck is 13 cards" },
  { name: "GAMMA_MAX_CREDITS_PER_RUN", kind: "literal", value: "300", why: "post-hoc over-budget flag" },
  { name: "GAMMA_ESTIMATED_CREDITS_PER_RUN", kind: "literal", value: "300", why: "conservative reserve for in-flight/unknown runs" },
];
const EXPECTED_PRESENT = ["GAMMA_API_KEY", ...PLAN.map((p) => p.name)];

const vercel = (a, input) => {
  const r = spawnSync("vercel", a, { shell: true, encoding: "utf8", input });
  return { ...r, stdout: `${r.stdout ?? ""}
${r.stderr ?? ""}` }; // the CLI prints listings and banners on either stream
};
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };

if (flag("--verify")) {
  const r = vercel(["env", "ls", "preview", BRANCH, "--scope", SCOPE]);
  // An unlinked directory returns an error/empty listing: never report that as "everything missing".
  if (r.status !== 0 || !/Environment Variables found/.test(r.stdout)) die("could not list Vercel variables (is this directory linked? vercel link --yes --project project-scquo --scope teacher-app).");
  const present = new Set([...r.stdout.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s/gm)].map((m) => m[1]));
  let missing = 0;
  for (const n of EXPECTED_PRESENT) { const ok = present.has(n); if (!ok) missing++; console.log(`${ok ? "present" : "MISSING"}  ${n}`); }
  console.log(missing ? `${missing} variable(s) missing.` : "All expected branch-scoped variables are present (values not checked or shown).");
  process.exit(missing ? 1 : 0);
}

console.log(`${flag("--apply") ? "APPLYING" : "DRY RUN — nothing will be written"}: Vercel project project-scquo, environment Preview, git branch "${BRANCH}" ONLY.`);
console.log("Not touched: Production, other Preview branches, staging.layah.in, GAMMA_API_KEY (already set), any database.\n");
for (const p of PLAN) {
  const shown = p.kind === "literal" ? (p.sensitive ? "(hidden placeholder)" : p.value) : `(from layah-staging ${STAGING_REF}, hidden)`;
  console.log(`  add  ${p.name.padEnd(34)} = ${shown}${p.sensitive ? "  [sensitive]" : ""}\n       ${p.why}`);
}
if (!flag("--apply")) { console.log("\nRe-run with --apply to write these."); process.exit(0); }

// ── apply ──
if (!tester || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(tester)) die("--tester-email <address> is required for --apply.");
let linked = {};
try { linked = JSON.parse(readFileSync(new URL("../.vercel/project.json", import.meta.url), "utf8")); } catch {}
if (linked.projectId !== PROJECT_ID) die("this directory is not linked to project-scquo. Run: vercel link --yes --project project-scquo --scope teacher-app");

const keysRaw = spawnSync("npx", ["supabase", "projects", "api-keys", "--project-ref", STAGING_REF, "-o", "json"], { shell: true, encoding: "utf8" }).stdout;
let keys;
try { keys = Object.fromEntries(JSON.parse(keysRaw.slice(keysRaw.indexOf("["))).map((k) => [k.name ?? k.id, k.api_key])); } catch { die("could not read the staging API keys from the Supabase CLI."); }
if (!keys.anon || !keys.service_role) die("staging anon/service_role key missing.");
const secrets = { "staging-url": `https://${STAGING_REF}.supabase.co`, "staging-anon": keys.anon, "staging-service": keys.service_role };
if (secrets["staging-url"].includes(PROD_REF)) die("resolved URL is production.");

let failed = 0;
for (const p of PLAN) {
  const value = p.kind === "literal" ? (p.name === "GAMMA_TESTER_EMAILS" ? tester : p.value) : secrets[p.kind];
  const r = vercel(["env", "add", p.name, "preview", BRANCH, "--force", "--scope", SCOPE, ...(p.sensitive ? ["--sensitive"] : [])], value);
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "ok    " : "FAILED"} ${p.name}${ok ? "" : `  (${(r.stderr || r.stdout).split("\n").find((l) => l.trim()) ?? "error"})`}`);
}
process.exit(failed ? 1 : 0);
