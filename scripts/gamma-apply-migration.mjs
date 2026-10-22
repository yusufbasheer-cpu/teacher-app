#!/usr/bin/env node
// Applies ONE allowlisted migration file to ONE explicitly named, verified STAGING project.
// Usage: node scripts/gamma-apply-migration.mjs <project-ref> [--migration gamma_generations|gamma_source_snapshots|gamma_pptx_artifacts|ai_usage_events|school_templates|razorpay_orders_currency] [--expect-name layah-staging]
// (default migration: gamma_generations). Arbitrary files cannot be passed.
// Refuses: the known production ref, any ref whose name differs from --expect-name, any project that is not ACTIVE_HEALTHY.
// Does not read any .env file and never uses `db push` (which would apply every pending migration).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROD_REF = "jbwevzvtloahjoamwnjt";
const MIGRATIONS = {
  gamma_generations: "20261022120000_gamma_generations.sql",
  gamma_source_snapshots: "20261023090000_gamma_source_snapshots.sql",
  gamma_pptx_artifacts: "20261023093000_gamma_pptx_artifacts.sql",
  ai_usage_events: "20261022171633_ai_usage_events.sql",
  school_templates: "20260919120000_school_templates.sql",
  razorpay_orders_currency: "20261010120000_razorpay_orders_currency.sql",
};
const which = process.argv.includes("--migration") ? process.argv[process.argv.indexOf("--migration") + 1] : "gamma_generations";
if (!MIGRATIONS[which]) { console.error(`REFUSED: --migration must be one of ${Object.keys(MIGRATIONS).join(", ")}.`); process.exit(1); }
const [VERSION, NAME] = [MIGRATIONS[which].split("_")[0], MIGRATIONS[which].replace(/^\d+_/, "").replace(/\.sql$/, "")];
const FILE = fileURLToPath(new URL(`../supabase/migrations/${MIGRATIONS[which]}`, import.meta.url));
const ref = process.argv[2];
const expectName = process.argv.includes("--expect-name") ? process.argv[process.argv.indexOf("--expect-name") + 1] : "layah-staging";

const run = (args) => spawnSync("npx", ["supabase", ...args], { shell: true, encoding: "utf8" });
const die = (msg) => { console.error(`REFUSED: ${msg}`); process.exit(1); };

if (!ref || !/^[a-z0-9]{20}$/.test(ref)) die("pass a 20-character project ref.");
if (ref === PROD_REF) die("that is the PRODUCTION project. This migration is never applied to production by this script.");

const list = run(["projects", "list", "--output-format", "json"]);
let projects;
try { projects = JSON.parse(list.stdout).projects; } catch { die("could not read `supabase projects list` (are you logged in?)."); }
const p = projects.find((x) => x.ref === ref);
if (!p) die(`project ${ref} not found in your organisation.`);
if (p.name !== expectName) die(`project ${ref} is named "${p.name}", expected "${expectName}".`);
if (p.status !== "ACTIVE_HEALTHY") die(`project "${p.name}" status is ${p.status}; it must be ACTIVE_HEALTHY (resume it first).`);
// `supabase db query --linked` targets the directory's linked project: it must be exactly the verified one.
let linked = "";
try { linked = readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8").trim(); } catch {}
if (linked !== ref) die(`this directory is linked to "${linked || "nothing"}", not ${ref}. Run: npx supabase link --project-ref ${ref}`);
console.log(`Target verified: ${p.name} (${p.ref}, ${p.region}, ${p.status}). Applying ${MIGRATIONS[which]}...`);

const apply = run(["db", "query", "--linked", "-f", FILE]);
if (apply.status !== 0) { console.error(apply.stdout, apply.stderr); die("migration failed; nothing else was run."); }
const q = (sql) => run(["db", "query", "--linked", `"${sql}"`]);
// `db query -f` does not touch Supabase's migration history; record it so `migration list` stays truthful.
q(`insert into supabase_migrations.schema_migrations (version, name) values ('${VERSION}','${NAME}') on conflict do nothing;`);
console.log(`Applied and recorded ${VERSION} ${NAME}.`);
