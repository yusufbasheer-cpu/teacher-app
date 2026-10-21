# Phase 1.1 visual refinement

**Status: PROVISIONAL — AWAITING APPROVAL**

This iteration retains the Phase 1 renderer integration, layout IDs, content limits, native editable text, deterministic feature gate, and existing fallback. It changes only the visual composition of the two provisional learning-objective layouts and the presentation preview framing.

## Refined Statement — `lo_statement_01`

- Light off-white canvas with a single teal registration line.
- Editorial objective field occupies the left 59 percent of the slide.
- Objective uses Poppins Bold at 42, 36, or 30 pt based on length; fallback order remains Arial and Calibri.
- A native-shape rising path balances the composition and reinforces progression toward a learning goal.
- The path contains no labels or invented teaching content.
- Objective slot: x 0.920, y 2.063, w 7.866, h 3.675 in.
- Existing limit remains 280 characters, six explicit lines, and 28 pt minimum.

## Refined Target — `lo_target_01`

- Deep Navy canvas with one narrow Mint edge marker.
- Objective area expands to 51 percent of the slide width and is no longer enclosed by nested cards.
- Objective uses Poppins Bold at 40, 35, or 30 pt based on length; fallback order remains Arial and Calibri.
- Four precisely aligned native PowerPoint circles form the target.
- One native arrow connects the objective field to the target center.
- Tiny labels, the decorative sidebar, crosshair, nested card and promotional tagline were removed.
- Objective slot: x 0.920, y 2.085, w 6.800, h 3.375 in.
- Existing limit remains 140 characters, four explicit lines, and 26 pt minimum.

## Approval evidence

- Updated three-way comparison: `artifacts/phase1.1-learning-objective/comparison.png`
- Statement before/after: `artifacts/phase1.1-learning-objective/statement-before-after.png`
- Target before/after: `artifacts/phase1.1-learning-objective/target-before-after.png`
- Long-objective render: `artifacts/phase1.1-learning-objective/rendered/statement-long/slide-04.png`
- Editable samples: `water-cycle-existing.pptx`, `water-cycle-statement.pptx`, `water-cycle-target.pptx`, and `water-cycle-statement-long.pptx`

All comparison decks use the exact same educational objective for slide 4. The long-objective sample uses the Statement layout because it exceeds the Target layout's verified budget. The feature remains disabled unless `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED=true`.
