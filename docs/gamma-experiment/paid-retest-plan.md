# Paid retest: Force and Pressure (one controlled Gamma run)

Goal: verify on real Gamma that the deck keeps the platform's slides and text exactly and only improves the design.
Budget: one new generation. The redownload in step 5 must cost nothing.

## Before the run
- Branch `experiment/gamma-ppt-integration` pushed and the preview build is `success`.
- `GET /api/environment-check` on the preview shows the staging Supabase ref and no live Razorpay key.

## Run
1. On the preview, open **My lessons → Force and Pressure** (the same saved lesson the benchmark decks came from). Do not edit it.
2. Pick the same theme and the same picture setting as the 2026-10-23 Gamma deck, and note both here: theme `______`, pictures `______`.
3. Click **Download PowerPoint** once. Save the file and the `X-Layah-Gamma-Report` response header (browser DevTools → Network).
4. Run the measurement harness on the file:
   `GAMMA_MEASURE_PPTX="<path>" npx vitest run src/lib/gamma/deck-measure.test.ts`
5. Reload the page and click **Download PowerPoint** again. It must come from storage: the report says `resumed: true`, and the ledger credits don't change.

## What to record
| # | Measure | Expected | Source |
|---|---|---|---|
| 1 | Slide count and boundaries | 17; split `1,1,1,1,1,1,2,2,2,2,1,1,1`; each slide's first line matches the plan | harness `slides`, `perSlide.expected/got` |
| 2 | Educational text | content verdict `passed` (strict, line by line). `failed` is a failed run, whatever it looks like | server report `verdict`; harness `contentVerdict` |
| 3 | Fonts and readability | body text ≥ 14 pt on every slide; no autofit shrink below 0.9. Baseline (old deck): 7.5–9.5 pt on slides 6–7 | harness `minPt`, `medianPt`, `autofit` |
| 4 | Visuals | one concept diagram on slide 6; no pictures on text-only slides; nothing decorative | harness `pictures`, plus a look at the deck |
| 5 | Gamma credits | record `creditsDeducted` (for reference, the 13-slide Light run on 2026-10-22 cost 45) | report header `creditsDeducted`; AI usage panel |
| 6 | Stored redownload | `resumed: true`, no new generation, credits unchanged | step 5 |

## Notes
- The server's own validation compares against the exact saved lesson and is authoritative. The harness compares against
  `__fixtures__/force-and-pressure.json`, reconstructed from the platform deck, so a stray mismatch there should be
  checked against the server report before being called a failure.
- The request hash differs from the earlier condense-mode run, so this is one new paid generation, as expected.
- Expected count is 17, not 18. The 18-slide platform deck had a picture on the Plenary slide that narrowed its text. The
  educational text is identical (content hash `cfb4129322b10bd7` for both), and `main`'s renderer also gives 17 without pictures.
