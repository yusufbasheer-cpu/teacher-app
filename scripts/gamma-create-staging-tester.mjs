#!/usr/bin/env node
// Creates ONE pre-confirmed email/password tester account in the STAGING Supabase project, via the admin API.
//   - Locked to project esqnyktumxscyvznftlc (layah-staging). Refuses the production ref, any other ref, an unhealthy project,
//     a mismatched linked directory, and a service-role key whose JWT `ref` claim is not the staging ref.
//   - email_confirm:true => no confirmation email; no password-reset is requested. Nothing is emailed by this script.
//   - Password: read from a hidden prompt (or STAGING_TESTER_PASSWORD in YOUR shell). Never printed, logged, stored or accepted as an argument.
//   - Default is a DRY RUN (prerequisite checks only). Creation needs BOTH --create and --confirm-ref esqnyktumxscyvznftlc.
//
//   node scripts/gamma-create-staging-tester.mjs --email you@example.com                                      dry run
//   node scripts/gamma-create-staging-tester.mjs --email you@example.com --create --confirm-ref esqnyktumxscyvznftlc
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const STAGING_REF = "esqnyktumxscyvznftlc";
const PROD_REF = "jbwevzvtloahjoamwnjt";
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const email = opt("--email")?.trim().toLowerCase();
const create = args.includes("--create");
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };
const run = (a) => spawnSync("npx", ["supabase", ...a], { shell: true, encoding: "utf8" });
const json = (t) => JSON.parse(t.slice(t.search(/[{[]/)));

if (args.includes("--password") || args.some((a) => a.startsWith("--password="))) die("passwords are never accepted as arguments (they leak into shell history and process lists).");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die("--email <address> is required.");
if (opt("--ref") === PROD_REF || args.includes(PROD_REF)) die("that is the PRODUCTION project.");
if (create && opt("--confirm-ref") !== STAGING_REF) die(`--create also requires --confirm-ref ${STAGING_REF}.`);

// ── 1. Target must be exactly the healthy staging project, and this directory must be linked to it ──
let projects;
try { projects = json(run(["projects", "list", "--output-format", "json"]).stdout).projects; } catch { die("could not read `supabase projects list` (logged in?)."); }
const p = projects.find((x) => x.ref === STAGING_REF);
if (!p || p.name !== "layah-staging") die("staging project not found or not named layah-staging.");
if (p.status !== "ACTIVE_HEALTHY") die(`staging status is ${p.status}.`);
let linked = "";
try { linked = readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8").trim(); } catch {}
if (linked !== STAGING_REF) die(`directory is linked to "${linked || "nothing"}"; run: npx supabase link --project-ref ${STAGING_REF}`);
console.log(`Target: ${p.name} (${p.ref}, ${p.region}, ${p.status})   email: ${email}`);

// ── 2. Prerequisites (read-only) ──
const q = (sql) => json(run(["db", "query", "--linked", `"${sql}"`, "-o", "json"]).stdout).rows;
const existing = q(`select count(*) as n from auth.users where lower(email)='${email.replace(/'/g, "''")}'`)[0].n;
if (Number(existing) > 0) die("an account with this email already exists in staging; nothing to do.");
const triggers = q("select count(*) as n from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal")[0].n;
console.log(`Prerequisites OK: no existing account; ${triggers} custom trigger(s) on auth.users (side effects other than the row itself: none expected when 0).`);
console.log("Plan: POST staging /auth/v1/admin/users {email, password:<hidden>, email_confirm:true}. No email is sent by this call. No password-reset or magic link is requested.");
if (!create) { console.log("\nDRY RUN: nothing created. Re-run with --create --confirm-ref " + STAGING_REF + " to proceed."); process.exit(0); }

// ── 3. Password (hidden) ──
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error("no interactive terminal"));
    process.stdout.write(prompt);
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
    let buf = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off("data", onData); process.stdout.write("\n"); return resolve(buf); }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1); else buf += c;
      }
    };
    process.stdin.on("data", onData);
  });
}
let password = process.env.STAGING_TESTER_PASSWORD;
if (!password) {
  try {
    password = await readHidden("Staging tester password (hidden): ");
    if (password !== (await readHidden("Repeat password (hidden): "))) die("passwords do not match.");
  } catch { die("no interactive terminal and STAGING_TESTER_PASSWORD is not set in this shell."); }
}
if (password.length < 12 || password.toLowerCase().includes(email.split("@")[0])) die("password must be at least 12 characters and must not contain your email name.");

// ── 4. Service-role key (staging only, verified by its JWT ref claim) ──
const keys = json(run(["projects", "api-keys", "--project-ref", STAGING_REF, "-o", "json"]).stdout);
const service = keys.find((k) => k.name === "service_role")?.api_key;
let claim; try { claim = JSON.parse(Buffer.from(service.split(".")[1], "base64url").toString()).ref; } catch {}
if (claim !== STAGING_REF) die("service-role key is not verifiably the staging project's.");

const res = await fetch(`https://${STAGING_REF}.supabase.co/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true }),
  signal: AbortSignal.timeout(30_000),
});
password = undefined;
const body = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`FAILED: HTTP ${res.status} ${String(body.msg ?? body.message ?? body.error_description ?? "").slice(0, 160)}`); process.exit(1); }
console.log(`Created staging user ${body.id}  email_confirmed: ${Boolean(body.email_confirmed_at)}  (project ${STAGING_REF})`);
console.log("No email was sent. Sign in on the preview with this email and the password you just set.");
