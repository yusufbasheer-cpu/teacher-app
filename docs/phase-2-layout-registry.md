# Phase 2 layout registry and deterministic selector

## Status

Phase 2 implemented. Phase 3 has not started. The two learning-objective layouts remain behind `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED`, which is disabled unless explicitly set to `true`.

## Architecture changes

The public generation API is unchanged. The schema, AI generation, legacy adapter, pagination system and PptxGenJS renderer remain in place.

```text
Structured lesson content
  -> existing schema validation and composition selection
  -> code-versioned layout registry
  -> deterministic rules selector
  -> registered learning-objective render function or legacy fallback
  -> existing PptxGenJS package repair
  -> editable PPTX
```

New modules:

- `src/lib/presentation/layout-registry.ts`: design-library types, the 13 proposal-level slide roles, and approved layout registrations.
- `src/lib/presentation/layout-selector.ts`: stable seeded selection, compatibility filtering, family-repeat avoidance and fallback decisions.
- `src/lib/presentation/quality-checks.ts`: registry integrity checks.

Only `learning-objectives` pedagogical-purpose slides enter the registry path. The remaining slide purposes continue through `addEducationalHeader` and `renderEducationalComposition` exactly as before.

## Registry definitions

| Layout ID | Design-library slide type | Family | Objective limit | Fit validation | Render function |
|---|---|---|---:|---|---|
| `lo_statement_01` | `learning-objective` | `statement` | 280 characters, 6 explicit lines, 28 pt minimum | Existing normalized-slot validation | Approved Statement renderer |
| `lo_target_01` | `learning-objective` | `target` | 140 characters, 4 explicit lines, 26 pt minimum | Existing normalized-slot validation | Approved Target renderer |

The registry is a TypeScript constant. It introduces no table, migration, query or database dependency. Its generic definition supports distinct content, context and content-limit types for the full 13-role design library without registering unimplemented layouts.

## Selection logic

1. Return the legacy path when the feature flag is disabled.
2. Load layouts registered for the exact design-library slide type.
3. Remove layouts whose fit predicate rejects the content.
4. Honour an internal verification override only when it is registered, type-compatible and fits.
5. When a previous family is supplied, remove it if another eligible family exists.
6. Canonicalize unchanged structured content and hash it with lesson ID, slide ID, slide type and eligible IDs.
7. Use the stable hash modulo the eligible layout count.
8. Return the legacy renderer when nothing qualifies.

The selector is synchronous and pure. It imports no AI client, network client, persistence layer or database module. Teacher-selected AfL metadata is neither read nor modified, and every non-learning-objective slide bypasses the selector.

Development logs record the selected layout ID with lesson and slide IDs. Legacy fallback logs record the reason when the feature is enabled but selection fails.

## Verification

- Registry validation covers IDs, slide types, families, named limits, fit functions and render functions.
- Determinism test repeats the same lesson selection ten times.
- Seed variation test exercises 100 lesson IDs and reaches both approved layouts.
- Fit tests cover short, long and oversized objectives.
- Override tests cover compatible and incompatible requests.
- Family-repeat test confirms an eligible alternative is preferred.
- Artifact integration generates both registered layouts without an override, then regenerates the same lesson and compares slide XML.
- Every non-learning-objective physical slide is compared with the legacy deck and must remain identical.
- PPTX package integrity and editable text are checked separately on the generated samples.

Representative outputs are stored in `artifacts/phase2-layout-registry/` with a selection manifest and PowerPoint-rendered slide 4 PNGs.

Verification results on 21 October 2026:

- Full Vitest suite: 481 passed, 2 opt-in artifact tests skipped.
- Phase 2 artifact integration: passed separately with generation enabled.
- TypeScript: passed.
- ESLint: no errors; 65 existing repository warnings.
- Next.js production build: passed.
- PowerPoint: all three representative decks opened and slide 4 rendered successfully.
- Package inspection: all three PPTX files passed with zero structural findings.
- OOXML inspection: slide 4 contains native editable text runs in every sample.
- Regression assertion: every non-learning-objective physical slide matches the legacy deck XML.

## Approved-layout follow-ups

These are recorded for a future visual refinement cycle and do not block Phase 2:

- Make the Statement learning-path motif more semantically meaningful.
- Refine the Target graphic's educational relevance.
