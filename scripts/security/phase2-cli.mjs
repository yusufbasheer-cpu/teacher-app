// Phase 2 database tooling for the ISOLATED STAGING project only, driven through the official Supabase CLI
// (`supabase db query --linked`, Management API). No database password, psql or Docker is needed; the CLI uses
// whatever login the operator already completed with `supabase login`.
//
//   node scripts/security/phase2-cli.mjs inventory                      read-only, runs immediately
//   node scripts/security/phase2-cli.mjs dry-run      --approve-dry-run     migration inside a ROLLED-BACK transaction
//   node scripts/security/phase2-cli.mjs isolation-test --approve-fixture-test   fixture test inside a ROLLED-BACK transaction
//
// Safety properties (all enforced here, not by convention):
//  * The project ref is a constant. The production ref is refused outright, and `--project-ref` is always passed explicitly.
//  * `inventory` only runs statements that are plain SELECT/WITH with no write-capable keyword or side-effect function.
//  * `dry-run` and `isolation-test` refuse to run without their approval flag. Both end with RAISE EXCEPTION carrying the
//    results as JSON, so PostgreSQL aborts the transaction (nothing persists) and the message is parsed for the report.
//    The migration itself is NEVER applied by this script.
//  * Nothing secret is read or printed: no tokens, passwords or connection strings are handled.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "esqnyktumxscyvznftlc";
const PRODUCTION_REF = "jbwevzvtloahjoamwnjt";
const CLI = ["--yes", "supabase@2.122.0"];
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(here, "..", "..", "supabase", "migrations", "20261025120000_phase2_rpc_and_school_policy_hardening.sql");

if (STAGING_REF === PRODUCTION_REF) throw new Error("refusing: staging ref equals production ref");

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|set|reset|vacuum|analyze|refresh|comment|lock|reindex|cluster|listen|notify|prepare|deallocate|discard|load|import|security|merge|into|begin|commit|rollback|savepoint)\b/i;
const SIDE_EFFECT_FN = /\b(pg_terminate_backend|pg_cancel_backend|set_config|nextval|setval|pg_advisory\w*|lo_\w+|pg_read_file|pg_ls_dir|pg_reload_conf|dblink\w*|http\w*|pg_sleep\w*|txid_\w+|pg_switch_wal|pg_create\w+|pg_drop\w+)\s*\(/i;

const strip = (sql) => sql.replace(/--[^\n]*/g, "").trim();
const split = (sql) => strip(sql).split(";").map((s) => s.trim()).filter(Boolean);
function assertReadOnly(stmt) {
  if (!/^(select|with)\b/i.test(stmt)) throw new Error("not a SELECT/WITH: " + stmt.slice(0, 60));
  const bare = stmt.replace(/'(?:[^']|'')*'/g, "''");
  const bad = bare.match(FORBIDDEN);
  if (bad) throw new Error(`forbidden keyword "${bad[0]}" in: ${stmt.slice(0, 80)}`);
  if (SIDE_EFFECT_FN.test(bare)) throw new Error("side-effect function in: " + stmt.slice(0, 80));
}

function query(sqlText) {
  const dir = mkdtempSync(join(tmpdir(), "p2-"));
  const file = join(dir, "q.sql").split("\\").join("/");
  writeFileSync(file, sqlText);
  const r = spawnSync("npx", [...CLI, "db", "query", "--linked", "--project-ref", STAGING_REF, "-o", "json", "--file", file], {
    encoding: "utf8", shell: true, maxBuffer: 128 * 1024 * 1024,
  });
  return { out: (r.stdout || "") + "\n" + (r.stderr || "") };
}

function resultFromError(out) {
  // The CLI prints the PostgreSQL error as JSON, so the payload arrives backslash-escaped and followed by a CONTEXT line.
  const i = out.indexOf("P2_RESULT:");
  if (i < 0) return null;
  let s = out.slice(i + "P2_RESULT:".length);
  const c = s.indexOf("CONTEXT:");
  if (c >= 0) s = s.slice(0, c);
  s = s.replace(/(\\n|\s)+$/, "").replace(/\\"/g, '"');
  try { return JSON.parse(s); } catch { return s; }
}

const [mode, ...flags] = process.argv.slice(2);

if (mode === "inventory") {
  const sql = readFileSync(join(here, "phase-2-catalog-inventory.sql"), "utf8");
  const stmts = split(sql);
  stmts.forEach(assertReadOnly); // validate everything before running anything
  const results = stmts.map((s, i) => {
    const { out } = query(s + ";\n");
    const j = out.slice(out.indexOf("{"));
    let parsed = null;
    try { parsed = JSON.parse(j.slice(0, j.lastIndexOf("}") + 1)); } catch { /* raw */ }
    console.error(`#${i + 1} ${parsed ? "rows=" + (parsed.rows?.length ?? "?") : "FAILED"}`);
    return { n: i + 1, sql: s, rows: parsed?.rows ?? null };
  });
  console.log(JSON.stringify(results, null, 1));
} else if (mode === "dry-run") {
  if (!flags.includes("--approve-dry-run")) throw new Error("refusing: dry-run executes the migration's DDL inside a transaction that is always rolled back. Re-run with --approve-dry-run after the operator approves.");
  const migration = readFileSync(MIGRATION, "utf8");
  const checks = `
do $$
declare res jsonb;
begin
  res := jsonb_build_object(
    'refund_anon',            has_function_privilege('anon',          'public.refund_user_generation(uuid, date)', 'execute'),
    'refund_authenticated',   has_function_privilege('authenticated', 'public.refund_user_generation(uuid, date)', 'execute'),
    'refund_service_role',    has_function_privilege('service_role',  'public.refund_user_generation(uuid, date)', 'execute'),
    'ensure_user_usage_anon', has_function_privilege('anon',          'public.ensure_user_usage()', 'execute'),
    'ensure_user_usage_auth', has_function_privilege('authenticated', 'public.ensure_user_usage()', 'execute'),
    'consume_anon',           has_function_privilege('anon',          'public.consume_user_generation()', 'execute'),
    'consume_auth',           has_function_privilege('authenticated', 'public.consume_user_generation()', 'execute'),
    'increment_anon',         has_function_privilege('anon',          'public.increment_user_generations()', 'execute'),
    'ensure_own_anon',        has_function_privilege('anon',          'public.ensure_own_user_usage()', 'execute'),
    'school_teachers_update_authenticated', has_table_privilege('authenticated', 'public.school_teachers', 'update'),
    'school_teachers_update_anon',          has_table_privilege('anon',          'public.school_teachers', 'update'),
    'wildcard_policy_exists', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_teachers' and policyname = 'school_admin_update_teacher_role'),
    'remaining_school_teachers_policies', (select coalesce(jsonb_agg(policyname order by policyname), '[]'::jsonb) from pg_policies where schemaname = 'public' and tablename = 'school_teachers')
  );
  raise exception 'P2_RESULT:%', res::text;
end $$;
rollback;
`;
  const { out } = query("begin;\n" + migration + "\n" + checks);
  console.log(JSON.stringify({ mode, result: resultFromError(out), rawTail: resultFromError(out) ? undefined : out.slice(-600) }, null, 1));
} else if (mode === "isolation-test") {
  if (!flags.includes("--approve-fixture-test")) throw new Error("refusing: the isolation test inserts fixture users/rows inside a transaction that is always rolled back. Re-run with --approve-fixture-test after the operator approves.");
  const src = readFileSync(join(here, "phase-2-isolation-transaction-test.sql"), "utf8");
  const cut = src.lastIndexOf("select verdict, test, detail from r");
  if (cut < 0) throw new Error("test file shape changed; cannot append the result-carrying tail");
  const head = src.slice(0, cut);
  // The Management API truncates error messages at ~900 chars, so results are returned in compact slices:
  //   (default) ids  -> every test id with a one-letter verdict (P/F/S) + verdict totals
  //   --slice=fail:N -> details of the non-PASS rows, 4 per page (N = 0, 1, 2, ...)
  const sliceArg = (flags.find((f) => f.startsWith("--slice=")) || "--slice=ids").slice("--slice=".length);
  const payload = sliceArg.startsWith("fail:")
    ? `(select coalesce(jsonb_agg(jsonb_build_object('t', left(test, 46), 'v', verdict, 'd', left(detail, 70)) order by test), '[]'::jsonb) from (select * from r where verdict <> 'PASS' order by test offset ${Number(sliceArg.slice(5)) * 4} limit 4) x)`
    : `(select jsonb_build_object('totals', (select jsonb_object_agg(verdict, c) from (select verdict, count(*) c from r group by 1) t), 'ids', (select string_agg(split_part(test, ' ', 1) || '=' || left(verdict, 1), ' ' order by test) from r where test like 'T%'), 'generic_nonpass', (select count(*) from r where test like 'generic:%' and verdict <> 'PASS')))`;
  const tail = `
do $$
begin
  raise exception 'P2_RESULT:%', ${payload}::text;
end $$;
rollback;
`;
  const { out } = query(head + tail);
  console.log(JSON.stringify({ mode, slice: sliceArg, result: resultFromError(out), rawTail: resultFromError(out) ? undefined : out.slice(-600) }, null, 1));
} else {
  console.error("usage: phase2-cli.mjs inventory | dry-run --approve-dry-run | isolation-test --approve-fixture-test");
  process.exit(2);
}
