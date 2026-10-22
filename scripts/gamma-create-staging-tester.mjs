#!/usr/bin/env node
// Creates ONE pre-confirmed email/password tester account in the STAGING Supabase project, via the Auth Admin API.
//   - Locked to project esqnyktumxscyvznftlc (layah-staging). Refuses the production ref, any other ref, an unhealthy project,
//     a mismatched linked directory, and a service-role key whose JWT `ref` claim is not the staging ref.
//   - The existing-user check uses the Admin API (no SQL is built from the email). A user that already exists is reported, never overwritten.
//   - email_confirm:true => no confirmation email; no password-reset is requested. Nothing is emailed by this script.
//   - Password: hidden prompt (or STAGING_TESTER_PASSWORD in YOUR shell). Never printed, logged, stored or accepted as an argument.
//   - Default is a DRY RUN (read-only checks). Creation needs BOTH --create and --confirm-ref esqnyktumxscyvznftlc.
//
//   node scripts/gamma-create-staging-tester.mjs --email you@example.com                                      dry run
//   node scripts/gamma-create-staging-tester.mjs --email you@example.com --create --confirm-ref esqnyktumxscyvznftlc
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  PROD_REF, STAGING_REF, StagingTesterError, adminCreateConfirmedUser, adminListUsers, assertStagingProject,
  extractRows, findUserByEmail, runCliJson, serviceKeyFromApiKeys,
} from "./lib/staging-tester-lib.mjs";

const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const email = opt("--email")?.trim().toLowerCase();
const create = args.includes("--create");
const die = (m) => { console.error(`REFUSED: ${m}`); process.exit(1); };

if (args.includes("--password") || args.some((a) => a.startsWith("--password="))) die("passwords are never accepted as arguments (they leak into shell history and process lists).");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die("--email <address> is required.");
if (opt("--ref") === PROD_REF || args.includes(PROD_REF)) die("that is the PRODUCTION project.");
if (create && opt("--confirm-ref") !== STAGING_REF) die(`--create also requires --confirm-ref ${STAGING_REF}.`);

// Static argument lists only (nothing user-supplied is ever placed in a shell command line).
const run = (a) => spawnSync("npx", ["supabase", ...a], { shell: true, encoding: "utf8" });

async function main() {
  // ── 1. Target must be exactly the healthy staging project, and this directory must be linked to it ──
  const p = assertStagingProject(runCliJson(run, ["projects", "list", "--output-format", "json"], { what: "`supabase projects list`" }));
  let linked = "";
  try { linked = readFileSync(new URL("../supabase/.temp/project-ref", import.meta.url), "utf8").trim(); } catch { /* reported below */ }
  if (linked !== STAGING_REF) die(`directory is linked to "${linked || "nothing"}"; run: npx supabase link --project-ref ${STAGING_REF}`);
  console.log(`Target: ${p.name} (${p.ref}, ${p.region}, ${p.status})   email: ${email}`);

  // ── 2. Read-only prerequisites, all through supported APIs ──
  const baseUrl = `https://${STAGING_REF}.supabase.co`;
  let service = serviceKeyFromApiKeys(runCliJson(run, ["projects", "api-keys", "--project-ref", STAGING_REF, "-o", "json"], { what: "`supabase projects api-keys`" }));
  const users = await adminListUsers(fetch, baseUrl, service);
  if (findUserByEmail(users, email)) die("an account with this email already exists in staging; nothing to do.");
  console.log(`Prerequisites OK: staging has ${users.length} user(s); none with this email.`);

  // Informational only (static SQL, no user input): custom triggers on auth.users could add side effects to user creation.
  try {
    const rows = extractRows(runCliJson(run, ["db", "query", "--linked", '"select count(*) as n from pg_trigger where tgrelid=\'auth.users\'::regclass and not tgisinternal"', "-o", "json"], { what: "trigger check" }));
    console.log(`Custom triggers on auth.users: ${rows[0]?.n ?? "unknown"} (0 = creating the user has no other side effects).`);
  } catch (e) {
    console.log(`Trigger check unavailable (${e instanceof StagingTesterError ? e.code : "error"}): ${e.message}. Not a blocker: it is informational.`);
  }
  console.log("Plan: POST staging /auth/v1/admin/users {email, password:<hidden>, email_confirm:true}. No email is sent by this call. No password-reset or magic link is requested.");
  if (!create) { console.log(`\nDRY RUN: nothing created. Re-run with --create --confirm-ref ${STAGING_REF} to proceed.`); return; }

  // ── 3. Password (hidden) ──
  let password = process.env.STAGING_TESTER_PASSWORD;
  if (!password) {
    try {
      password = await readHidden("Staging tester password (hidden): ");
      if (password !== (await readHidden("Repeat password (hidden): "))) die("passwords do not match.");
    } catch { die("no interactive terminal and STAGING_TESTER_PASSWORD is not set in this shell."); }
  }
  if (password.length < 12 || password.toLowerCase().includes(email.split("@")[0])) die("password must be at least 12 characters and must not contain your email name.");

  // ── 4. Create (pre-confirmed) and confirm the result by reading it back through the Admin API ──
  const created = await adminCreateConfirmedUser(fetch, baseUrl, service, email, password);
  password = undefined;
  const after = findUserByEmail(await adminListUsers(fetch, baseUrl, service), email);
  service = undefined;
  console.log(`Created staging user ${created.id}  email_confirmed: ${created.confirmed}  verified present: ${Boolean(after)}  (project ${STAGING_REF})`);
  console.log("No email was sent. Sign in on the preview with this email and the password you just set.");
}

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

main().catch((e) => {
  if (e instanceof StagingTesterError) { console.error(`REFUSED/FAILED [${e.code}]: ${e.message}`); process.exit(1); }
  console.error(`Unexpected error (${e?.name ?? "Error"}): ${String(e?.message ?? e).slice(0, 200)}`);
  process.exit(1);
});
