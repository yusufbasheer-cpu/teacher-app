#!/usr/bin/env node
// Applies ONLY supabase/migrations/20261022120000_gamma_generations.sql to ONE explicitly named, verified STAGING project.
// Usage: node scripts/gamma-apply-migration.mjs <project-ref> [--expect-name layah-staging]
// Refuses: the known production ref, any ref whose name differs from --expect-name, any project that is not ACTIVE_HEALTHY.
// Does not read any .env file and never uses `db push` (which would apply every pending migration).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROD_REF = "jbwevzvtloahjoamwnjt";
const FILE = fileURLToPath(new URL("../supabase/migrations/20261022120000_gamma_generations.sql", import.meta.url));
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
console.log(`Target verified: ${p.name} (${p.ref}, ${p.region}, ${p.status}). Applying one migration file...`);

const apply = run(["db", "query", "--project-ref", ref, "-f", FILE]);
if (apply.status !== 0) { console.error(apply.stdout, apply.stderr); die("migration failed; nothing else was run."); }
const check = run(["db", "query", "--project-ref", ref, "select count(*) as rows, (select count(*) from pg_indexes where tablename='gamma_generations') as indexes, (select relrowsecurity from pg_class where relname='gamma_generations') as rls from public.gamma_generations;"]);
console.log(check.stdout.trim());
console.log("Done. Next: GAMMA_LEDGER_IT=1 integration test (see docs/gamma-experiment/staging-activation.md).");
