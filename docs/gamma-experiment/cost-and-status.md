# Gamma experiment — status, validation design, cost estimate

## Verification status (read this first)

| Item | Status |
|---|---|
| Git baseline / branch | Verified: `experiment/gamma-ppt-integration` rebased onto `origin/main` @ `dc955af` (originally cut from `origin/staging` @ `c399da7`), worktree `C:\Liyaah\teacher-app-gamma-experiment` |
| Request/poll/download logic, validator, budget, provider gating | **Verified by 35 mocked tests** (`src/lib/gamma/gamma.test.ts`); full suite on the main base: 422 pass; `tsc --noEmit` clean |
| **Live Gamma generation** | **UNVERIFIED.** No `GAMMA_API_KEY` was available; no paid call was made. No claim of live success is made. |
| Export-URL host allowlist (`gamma.app`) | **Unverified** against a real export URL; override with `GAMMA_EXPORT_HOST_ALLOWLIST` |
| Image model names | Not hard-coded: docs list `flux-1-pro` only as an example and don't give tiers. Default = Gamma auto-select; set `GAMMA_IMAGE_MODEL` deliberately |
| Image count | Gamma docs: accent images **cannot be controlled via the API**. The "10–15 images" goal is only a prompt hint; the real count is measured (`imagesPictureCount`, `imageMediaFiles` in the log) |
| Theme comparison (3 themes) | Not done: needs a live key. List ids via `GET https://public-api.gamma.app/v1.0/themes`; the API exposes only `colorKeywords`/`toneKeywords`, no fonts/colours |
| Test A (maths) / Test B (science) live | Not run — requires approved credit budget |

## Docs points that differ from the brief (checked 2026-10-22)

- `https://developers.gamma.app/generations` is a 404; the current reference is `POST /v1.0/generations` (Classic). The docs now
  recommend `POST /agent/generations` ("Gamma 5") for new presentations; this experiment uses Classic because only it documents
  `textMode: preserve` + `cardSplit: inputTextBreaks` + `exportAs`. Worth a separate comparison later.
- `numCards` applies only with `cardSplit: auto`; with `inputTextBreaks` it is **ignored**, so it is not sent.
- Card delimiter is exactly `\n---\n`. Stray `---` lines in lesson text are blanked (counted in `neutralisedBreaks`).
- `preserve` "keeps the exact text … though it may add structure such as headings" — i.e. not a fidelity guarantee, hence the validator.
- Auth header `X-API-KEY`; API access requires Pro/Ultra/Teams/Business/Enterprise.
- Export URLs are bearer secrets valid ~1 week → never logged, API key never sent to them, downloaded immediately.
- Status response carries `credits.deducted` / `remaining`; poll every ~5 s, typical 1–3 min.

## What runs when Gamma is selected

`POST /api/lesson-plan/export/pptx` → existing auth/rate-limit → `buildStructuredLessonSlides()` (unchanged) → provider gate → `renderPptxWithGamma`:
payload (13 cards, student-facing text only, same filter as legacy) → create → poll → download (host/size/redirect/zip checks) → extract PPTX text → compare to the pre-generation snapshot → return the bytes with
`X-Layah-PPT-Provider: gamma`, `X-Layah-Gamma-Validation: passed|failed`, `X-Layah-Gamma-Issues: n`. The UI shows a red "FAILED, do not treat as validated" message when validation fails.
No fal.ai / Pexels / DeepSeek calls happen in this step.

Gate (all required): `GAMMA_EXPERIMENT_ENABLED=true`, `VERCEL_ENV != production`, caller email in `GAMMA_TESTER_EMAILS`, request field `pptProvider: "gamma"` (or env `PPT_GENERATION_PROVIDER=gamma`). Otherwise legacy, silently.

## Validation report (per run)

`ValidationReport` (`src/lib/gamma/validate.ts`): `passed`, slide counts, `matched`, `missing[]`, `modified[]` (≥60 % token overlap pairs), `unexpected[]`,
`movedBetweenSlides[]`, number and operator multiset diffs, question preservation, learning-objectives slide check, picture and media counts, `reasons[]`.
Normalisation is limited to whitespace/NBSP, markdown `**`/`__`, leading unordered bullet or `#` markers. Punctuation, digits, ordered-list numbers and operators are compared strictly.
Currently the report is returned in-process and summarised in headers/logs; there is no UI to browse it. Known limit: text only — it cannot judge whether an AI image is correct.

## Cost estimate — 100 decks / month (THEORETICAL, from Gamma's published ranges)

Published: cards 1–3 credits each; images Standard 2–15, Advanced 20–33, Premium 34–75, Ultra 30–125 credits each. Gamma may change these.
Credit → currency conversion is not in the pages read; check your plan before budgeting money.

| Scenario | Per deck (credits) | 100 decks |
|---|---|---|
| 13 cards, 10–15 Standard images | 13–39 + 20–225 = **33–264** | **3,300–26,400** |
| 13 cards, 10–15 Advanced images | 13–39 + 200–495 = **213–534** | **21,300–53,400** |
| 20 cards, 10–15 Standard images | 20–60 + 20–225 = **40–285** | **4,000–28,500** |
| 20 cards, 10–15 Advanced images | 20–60 + 200–495 = **220–555** | **22,000–55,500** |

Caveats: image count isn't controllable, so actual image credits may fall outside 10–15 × tier; the model Gamma auto-selects may be above Standard. **Replace this table with observed `creditsDeducted` from the first live runs** (logged as `[gamma-ppt] {...}`).
Also unaccounted for: legacy fal/Pexels spend still occurs at lesson creation (see audit §C).

## Safeguards

`GAMMA_MAX_CARDS_PER_RUN` (25), `GAMMA_MAX_CREDITS_PER_RUN` (300, post-hoc flag `overRunBudget` — Gamma exposes no cancel/balance call, so it cannot abort mid-run),
`GAMMA_EXPERIMENT_CREDIT_BUDGET` (3000, in-memory per server instance: best-effort on serverless). Hard backstop: keep Gamma auto-recharge **off**.
Duplicate protection: server-side in-flight lock (user + content hash), plus the existing UI `busy` state that disables the download buttons. A repeat click *after* completion is a new, paid run by design.

## Before the first live run (needs your approval)

1. Provide `GAMMA_API_KEY` (staging env only), set `GAMMA_EXPERIMENT_ENABLED=true`, `GAMMA_TESTER_EMAILS`, `NEXT_PUBLIC_GAMMA_EXPERIMENT=true`.
2. Approve a credit budget. Suggested: one 3-card smoke run first, then Test A (Grade 8 maths) and Test B (Grade 8 science).
3. Run `GET /themes`, pick up to three theme ids, repeat with `GAMMA_THEME_ID`.
4. Inspect the logged `validation`, `imagesPictureCount`, `creditsDeducted`; open the PPTX in PowerPoint to judge visual quality.
