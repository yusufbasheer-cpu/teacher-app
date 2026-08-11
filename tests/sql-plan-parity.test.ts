import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dbLimitValue, PLAN_IDS, PLANS } from "@/lib/plans";

/**
 * SQL cannot import TypeScript, so src/lib/plans.ts and the
 * plan_generations_limit() SQL function are two independently-maintained
 * copies of the same numbers. This spec is what stops them from drifting
 * silently again the way the free-tier limit did (15 in TS, 3 in a SQL
 * column default, for months). It reads the migration file as text — no DB
 * connection, fully deterministic, runs in plain CI.
 */

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
// Points at whichever migration most recently redefined
// plan_generations_limit() via `create or replace function` — never edit an
// already-shipped migration in place; when the limits change again, add a
// new migration and repoint this constant at it, same as this file moved
// from 20260728120000_usage_gate_functions.sql to this one when the Free
// tier dropped from 15 to 3.
const SOURCE_OF_TRUTH_MIGRATION = "20260811130000_free_tier_three_generations.sql";

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf8");
}

function parsePlanGenerationsLimitCases(sql: string): { cases: Map<string, number>; fallback: number | null } {
  const fnMatch = sql.match(/create or replace function public\.plan_generations_limit[\s\S]*?\$\$([\s\S]*?)\$\$/);
  if (!fnMatch) {
    throw new Error("Could not find plan_generations_limit() function body in the migration file.");
  }
  const body = fnMatch[1];

  const cases = new Map<string, number>();
  const caseRe = /when\s+'(\w+)'\s+then\s+(-?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = caseRe.exec(body))) {
    cases.set(m[1], Number(m[2]));
  }

  const elseMatch = body.match(/else\s+(-?\d+)/);
  const fallback = elseMatch ? Number(elseMatch[1]) : null;

  return { cases, fallback };
}

describe("SQL plan_generations_limit() matches src/lib/plans.ts", () => {
  const sql = readMigration(SOURCE_OF_TRUTH_MIGRATION);
  const { cases, fallback } = parsePlanGenerationsLimitCases(sql);

  it("defines exactly the same plan ids as PLAN_IDS", () => {
    expect(new Set(cases.keys())).toEqual(new Set(PLAN_IDS));
  });

  it("each plan's SQL limit matches its TypeScript dbLimitValue", () => {
    for (const id of PLAN_IDS) {
      expect(cases.get(id), `plan_generations_limit('${id}')`).toBe(dbLimitValue(id));
    }
  });

  it("the SQL else-fallback matches the free plan's limit", () => {
    expect(fallback).toBe(PLANS.free.generationsLimit);
  });

  it("the column default derives from the function, not a hardcoded number", () => {
    expect(sql).toContain("set default public.plan_generations_limit('free')");
  });
});

describe("no migration re-introduces the old generations_limit default of 3", () => {
  // These two pre-date this hardening pass and are the ones that drifted;
  // grandfathered rather than fixed in place, since the new migration's
  // backfill (UPDATE ... WHERE plan_type = 'free' AND generations_limit = 3)
  // already corrects any row created under the old default.
  const KNOWN_LEGACY_FILES = new Set([
    "20260524120000_user_usage.sql",
    "20260525140000_user_usage_ensure_table.sql",
  ]);

  it("scans every migration for a literal `generations_limit ... default 3`", () => {
    const offenders: string[] = [];
    for (const filename of readdirSync(MIGRATIONS_DIR)) {
      if (!filename.endsWith(".sql") || KNOWN_LEGACY_FILES.has(filename)) continue;
      const sql = readMigration(filename);
      if (/generations_limit\s+integer[^,;]*default\s+3\b/i.test(sql)) {
        offenders.push(filename);
      }
    }
    expect(offenders).toEqual([]);
  });
});
