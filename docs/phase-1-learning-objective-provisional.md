# Phase 1 learning-objective layouts

**Status: PROVISIONAL — AWAITING APPROVAL**

These designs are original, code-rendered layouts built with the repository's existing PptxGenJS renderer. They affect only slides whose pedagogical purpose is `learning-objectives`. All dynamic text remains native PowerPoint text. No paid or proprietary visual assets are used, and neither design requires a raster background.

## Feature gate

- Environment flag: `PPT_LEARNING_OBJECTIVE_LAYOUTS_ENABLED`
- Default: disabled (unset or any value other than the exact string `true`)
- Disabled behaviour: the current learning-objective renderer is used unchanged.
- Enabled automatic rule: `lo_target_01` for objectives that fit its 140-character slot; otherwise `lo_statement_01` up to 280 characters; otherwise the current renderer.
- The teacher-facing UI does not expose layout IDs or a layout selector.

## Layout A — Statement

| Property | Specification |
|---|---|
| Layout ID | `lo_statement_01` |
| Canvas | 13.333 × 7.5 in, 16:9 |
| Background | Native editable shapes; no PNG required |
| Palette | Navy `#102A43`, teal `#0F8B8D`, mint `#BEE9E8`, off-white `#F7F5EF` |
| Heading | Poppins Bold; fallback Arial, Calibri |
| Objective | Poppins Bold, 39/34/29 pt according to length; fallback Arial, Calibri |
| Label slot | x 0.920, y 1.553, w 8.933, h 0.413 in; optional; 32 characters; 1 line |
| Objective slot | x 0.920, y 2.138, w 9.146, h 3.525 in; required; 280 characters; 6 explicit lines; minimum 28 pt |
| Fit rule | Reject when required text is empty, exceeds 280 characters, or exceeds 6 explicit lines |
| Reference screenshot | `artifacts/phase1-learning-objective/rendered/statement/slide-04.png` |

The composition uses an off-white reading field, a restrained teal registration bar, and a navy side rail that carries the slide marker and learning cue.

## Layout B — Target

| Property | Specification |
|---|---|
| Layout ID | `lo_target_01` |
| Canvas | 13.333 × 7.5 in, 16:9 |
| Background | Native editable shapes; no PNG required |
| Palette | Navy `#102A43`, teal `#0F8B8D`, mint `#BEE9E8`, off-white `#F7F5EF` |
| Heading | Poppins Bold; fallback Arial, Calibri |
| Objective | Poppins Bold, 36/31/27 pt according to length; fallback Arial, Calibri |
| Label slot | x 1.147, y 1.538, w 6.000, h 0.413 in; optional; 32 characters; 1 line |
| Objective slot | x 1.147, y 2.190, w 6.160, h 3.450 in; required; 140 characters; 4 explicit lines; minimum 26 pt |
| Fit rule | Reject when required text is empty, exceeds 140 characters, or exceeds 4 explicit lines |
| Reference screenshot | `artifacts/phase1-learning-objective/rendered/target/slide-04.png` |

The composition uses a high-contrast content card beside a target constructed from native circles and rules. The target is decorative; the educational content stays in an editable text shape.

## Approval comparison

- Current renderer: `artifacts/phase1-learning-objective/rendered/existing/slide-04.png`
- Statement proposal: `artifacts/phase1-learning-objective/rendered/statement/slide-04.png`
- Target proposal: `artifacts/phase1-learning-objective/rendered/target/slide-04.png`
- Editable sample decks: `water-cycle-existing.pptx`, `water-cycle-statement.pptx`, `water-cycle-target.pptx`
- Long-objective validation deck: `water-cycle-statement-long.pptx`

The three comparison decks contain the same 13-slide lesson and identical learning-objective content. Only the learning-objective layout differs.
