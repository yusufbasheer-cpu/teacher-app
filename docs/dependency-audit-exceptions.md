# Dependency audit exception register

Reviewed: 2026-10-28
Owner: Platform/Security
Next review: 2026-11-28, or immediately on a new high/critical advisory

This is an exception register, not a vulnerability fix. With Node `v24.15.0`,
npm `11.12.1`, and lockfile version 3, both `npm audit --omit=dev --json` and
`npm audit --json` currently report eight findings: 0 critical, 2 high,
3 moderate, and 3 low. Auditing remains enabled and no advisory is suppressed.

| Package/version | Advisory / severity | Directness and reachability | Fix and blocker | Mitigation, residual risk, owner |
|---|---|---|---|---|
| `@babel/core@7.29.0` | GHSA-4x5r-pxfx-6jf, low | Transitive through Sentry bundling; build tooling, not production request handling | Audit reports a fix; upgrading the toolchain is a separate compatibility change | No runtime reachability identified; Platform/Security owns review by 2026-11-28 |
| `deepmerge@4.3.1` | GHSA-gcqx-w48m-w2h4, low | Transitive through `shadcn@4.16.0`; CLI/build tooling | Audit proposes `shadcn@1.0.0`, a breaking major change | `shadcn` is not imported by production route code; Platform/Security review by 2026-11-28 |
| `fflate@0.4.8` | GHSA-px8p-9vwx-vf98, moderate | Transitive through `posthog-js@1.440.0`; client-side decompression path | Audit reports an update; PostHog compatibility must be verified before changing it | No server-side PPT/ZIP parser reachability found; Platform/Security review by 2026-11-28 |
| `image-size@1.2.1` | GHSA-5p2g-fcmc-qvqq, high (JXL/HEIF DoS) | Transitive through `pptxgenjs@4.0.1`; vulnerable parser remains in the package tree | Audit proposes `pptxgenjs@4.0.0`, a downgrade/compatibility risk | All live untrusted image inputs are signature-checked, pixel-bounded, decoded/resized with Sharp, and converted to bounded JPEG before PptxGenJS. Tests cover malformed, unsupported, oversized, and valid images. Residual dependency risk; Platform/Security review by 2026-11-28 |
| `image-size@1.2.1` | GHSA-w3rx-r6r6-pgpr, high (ICNS DoS) | Same PptxGenJS transitive path | Same downgrade/compatibility blocker | ICNS is rejected before PptxGenJS; residual dependency risk remains; Platform/Security review by 2026-11-28 |
| `postcss-selector-parser@6.0.10` | GHSA-rj75-hqrm-r3gf, moderate | Nested dependency of `@tailwindcss/typography@0.5.20`; build/CSS processing | Audit proposes `@tailwindcss/typography@0.5.4`, a breaking downgrade | No runtime request-parser reachability identified; Platform/Security review by 2026-11-28 |
| `pptxgenjs@4.0.1` | GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr via `image-size`, high | Direct production dependency used by legacy PPT generation/export | Audit fix is `4.0.0` and is not accepted without compatibility testing | The application boundary prevents untrusted formats/bytes from reaching the parser; legacy, Gamma-adjacent, upload, URL, and retry flows were traced. Residual dependency risk; Platform/Security review by 2026-11-28 |
| `shadcn@4.16.0` | GHSA-gcqx-w48m-w2h4, low via `deepmerge` | Direct CLI/dev dependency; not imported by production route code | Audit proposes breaking `shadcn@1.0.0` | No production runtime reachability identified; Platform/Security review by 2026-11-28 |

## PptxGenJS/image-size evidence

The application does not pass request-controlled image URLs or raw image bytes directly
to PptxGenJS. `ppt-template-engine.ts` restricts external inputs to JPEG/PNG/WebP
signatures, enforces a 20 MB byte limit and 40M-pixel budget, decodes/resizes with
Sharp, and emits JPEG data URIs before `slide.addImage`. This boundary covers:
legacy lesson/PPT exports, structured deck exports, cached/generated image URLs,
school-logo data extracted from uploaded templates, and retry/reuse paths. Uploaded
template rendering separately applies the same signature, byte, pixel, and Sharp-JPEG
normalization before sending images to the template service. Static Layah branding is
repository-controlled, not untrusted input. The old `fetchImageUrlAsDataUri` helper in
`lesson-plan-export.ts` is unused and does not feed a live PptxGenJS path; it must not
be wired into production without using `normalizePptImageForPptx`.

`ppt-template-engine.test.ts`, upload/export tests, and the full suite cover valid
conversion plus malformed, unsupported, oversized, and concurrent export behavior.

This is a documented, time-bounded exception—not an assertion that the high advisories
are fixed. Live staging load/timeout validation and a future compatible dependency
upgrade remain required.
