# Phase 1: learning-objective vertical slice

Date: 20 October 2026

## Status

Asset-ready foundation complete. Final layout implementation and the visual go/no-go gate are blocked because Yusuf's approved Canva design packages are not present.

The search covered the repository and the accessible OneDrive tree. No learning-objective reference screenshot, text-free background PNG, slot specification, or approved layout ID was found. The proposal PDF is the only matching design-library artifact.

Following the requested fallback, this change does not invent designs or connect placeholder layouts to production rendering.

## Implemented

- `LearningObjectiveLayoutDefinition` for the existing PptxGenJS architecture.
- Named `label` and `objective` content slots.
- Explicit character, line and minimum-font constraints.
- Normalized slot geometry that resolves against the active slide dimensions.
- Required 16:9 aspect-ratio validation.
- Required text-free PNG background reference.
- Required font fallback lists.
- Deterministic content preflight for short, boundary-length and overflowing objectives.
- A render-function signature that keeps PowerPoint text native and editable.
- Tests use an explicitly test-only ID and background path. They are not production designs.

## Deliberately not implemented

- No approved layout IDs were guessed.
- No Canva backgrounds or reference screenshots were recreated.
- No final render functions were authored.
- No layout selector or full registry was started.
- No other slide type was changed.
- No production renderer dispatch was changed.
- No user-facing layout selector was added.

## Frontend refinements

- The PowerPoint output now explains that it creates a 13-slide editable presentation using the selected theme.
- Presentation previews use a 16:9 framed canvas treatment that distinguishes them from Word-style artifacts.
- The PowerPoint download action receives stronger visual weight while active.
- Existing error, loading and disabled behavior remains connected to the same business logic.

## Required asset package

For each of the two approved layouts, supply:

1. Reference screenshot at 16:9.
2. Text-free background PNG at the same aspect ratio.
3. Approved layout ID.
4. Slot specification containing normalized or pixel coordinates, maximum characters, maximum lines, minimum font size, alignment, text color and fallback font.

Once supplied, implementation can populate two `LearningObjectiveLayoutDefinition` objects, code their render functions, render identical short and long objectives, and connect only slide 4 to an isolated automatic selector.

## Go / no-go gate

Status: **NO-GO pending approved design assets**.

There are no honest side-by-side layout screenshots to compare. The current slide remains the baseline, and neither proposed variant exists in an approved, renderable form. The gate must remain closed until both layouts can be compared using identical content in PowerPoint output.

PowerPoint, Google Slides and Keynote validation was not claimed. No new deck variants exist to open in those applications.
