# Phase 1 Baseline

Date: 2026-08-31

Branch: `phase-1-boundary-stabilization`

Base commit before docs baseline: `f05e6c0067d5d7e396f76f6418a5b9d72c568325`

Purpose: freeze the current audit findings before any production-code changes.

## What Was Done

- Created the migration-audit documentation set under `docs/migration-audit/`.
- Ran safe baseline checks.
- Inventoried browser-side network access.
- Inventoried direct browser-side Supabase usage.
- Prepared this documentation baseline for commit before production-code work.

## Baseline Checks

- `npm run typecheck` - passed
- `npm run lint` - passed with warnings only
- `npm run test` - passed
- `npm run build` - passed

## Notes

- No production application code was modified in this checkpoint.
- The browser-side boundary is not yet clean: the UI still talks directly to Supabase in a few places and there are many client calls into local Next API routes.
- Reusable helpers already present in the repo and intended for later boundary work:
  - `src/lib/auth-headers.ts`
  - `src/lib/try-parse-api-json.ts`

