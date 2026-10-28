# Dependency audit exception register

Reviewed: 2026-10-28
Owner: Platform/Security
Next review: 2026-11-28, or immediately on a new high/critical advisory

This is an exception register, not a vulnerability fix. `npm audit --omit=dev`
currently reports eight findings (3 low, 3 moderate, 2 high, 0 critical). Auditing
remains enabled and no advisory is suppressed.

| Package/version | Advisory / severity | Directness and reachability | Fix and blocker | Mitigation, residual risk, owner |
|---|---|---|---|---|
| `@babel/core@7.29.0` | GHSA-4x5r-pxfx-6jf, low | Transitive through Sentry bundler and shadcn; build tooling, not production request handling | Audit reports a fix; upgrading the toolchain is a separate compatibility change | No runtime reachability identified; retain and review Platform/Security 2026-11-28 |
| `deepmerge@4.3.1` | GHSA-gcqx-w48m-w2h4, low | Transitive through `shadcn`; CLI/build tooling | Audit proposes `shadcn@1.0.0`, a breaking major change | Not imported by application runtime; retain and review Platform/Security 2026-11-28 |
| `fflate@0.4.8` | GHSA-px8p-9vwx-vf98, moderate | Transitive through `posthog-js`; client-side decompression path | Audit reports an available update; must verify PostHog compatibility | No server-side PPT/ZIP parser reachability found; review Platform/Security 2026-11-28 |
| `image-size@1.2.1` | GHSA-5p2g-fcmc-qvqq, high (JXL/HEIF DoS) | Transitive through `pptxgenjs@4.0.1`; parser is reachable when PptxGenJS inspects image data | Audit proposes `pptxgenjs@4.0.0`, which is a downgrade/compatibility risk; no safe upgrade selected yet | Untrusted image bytes are signature-checked, pixel-bounded, decoded/resized with Sharp, and converted to bounded JPEG before PptxGenJS. Tests cover malformed, unsupported, oversized, and valid image inputs. Residual risk: parser remains in dependency; Platform/Security review 2026-11-28 |
| `image-size@1.2.1` | GHSA-w3rx-r6r6-pgpr, high (ICNS DoS) | Same PptxGenJS transitive path | Same downgrade/compatibility blocker | ICNS is rejected by the signature allowlist before PptxGenJS; residual dependency risk remains; Platform/Security review 2026-11-28 |
| `postcss-selector-parser@6.0.10` | GHSA-rj75-hqrm-r3gf, moderate | Transitive through `@tailwindcss/typography@0.5.20`; build/CSS processing | Audit proposes `@tailwindcss/typography@0.5.4`, a breaking downgrade | No runtime request parser reachability identified; review Platform/Security 2026-11-28 |
| `pptxgenjs@4.0.1` | GHSA-5p2g-fcmc-qvqq, high via `image-size` | Direct production dependency used by PPT generation/export | Audit fix is `4.0.0` and is not accepted without compatibility testing | Route-level distributed limits, fail-closed Redis policy, Sharp normalization, and PPT image tests reduce exposure; residual risk remains; Platform/Security review 2026-11-28 |
| `shadcn@4.16.0` | GHSA-gcqx-w48m-w2h4, low via `deepmerge` | Direct CLI/dev dependency; not imported by production route code | Audit proposes breaking `shadcn@1.0.0` | No production runtime reachability identified; review Platform/Security 2026-11-28 |

## PptxGenJS/image-size evidence

The application does not pass request-controlled image URLs or raw image bytes directly
to PptxGenJS. `ppt-template-engine.ts` restricts inputs to JPEG/PNG/WebP signatures,
enforces a 20 MB byte limit and 40M-pixel budget, decodes/resizes with Sharp, and emits
JPEG data URIs before `slide.addImage`. School logos use the same normalization path;
server-fetched images use the SSRF-guarded fetch helper. `ppt-template-engine.test.ts`
covers valid conversion plus malformed, unsupported, and oversized input rejection.

This is a documented, time-bounded exception—not an assertion that the high advisories
are fixed. Live staging load/timeout validation and a future compatible dependency
upgrade remain required.
