# Frontend Network Boundary

Date: 2026-08-31

This pass focuses on browser-initiated traffic from React components, hooks, and browser-only libraries.

## Boundary Summary

- Preferred future boundary: `Frontend -> our backend API`
- Existing browser exceptions:
  - Supabase auth/session calls
  - direct browser-side Supabase data mutations
  - browser-loaded third-party scripts and telemetry SDKs

## Internal API Calls From The Browser

These are all `fetch()` calls from client code to local `"/api/..."` routes.

### Lesson planning and exports

- `/api/lesson-plan`
- `/api/lesson-plan/extract-upload`
- `/api/lesson-plan/export/docx`
- `/api/lesson-plan/export/pptx`
- `/api/lesson-plan/export/zip`

### Question paper

- `/api/question-paper`
- `/api/question-paper/blueprint`
- `/api/question-paper/export/docx`
- `/api/question-paper/export/blueprint`
- `/api/question-paper/export/zip`

### Differentiated pack

- `/api/differentiated-pack`
- `/api/differentiated-pack/extract`
- `/api/differentiated-pack/infer-meta`
- `/api/differentiated-pack/export-docx`
- `/api/differentiated-pack/export-zip`

### Auth, usage, pricing, and small utility endpoints

- `/api/auth/verify-captcha`
- `/api/auth/school-enrollment`
- `/api/user-usage`
- `/api/geo`
- `/api/contact`
- `/api/feedback`
- `/api/waitlist`
- `/api/welcome-email`

### Billing and admin

- `/api/razorpay/*`
- `/api/school-admin*`
- `/api/school-register`
- `/api/super-admin/*`
- `/api/hod/me`
- `/api/account/*`

## Browser-Loaded Third-Party Calls

These are the browser-side external requests that matter for boundary planning.

| Source | External destination | Notes |
| --- | --- | --- |
| `src/components/auth/turnstile-widget.tsx` | `https://challenges.cloudflare.com/turnstile/v0/api.js` | loads the captcha widget script directly in the browser |
| `src/app/layout.tsx` | `https://checkout.razorpay.com/v1/checkout.js` | loads Razorpay checkout directly in the browser |
| `src/components/sentry-provider.tsx` | Sentry ingest endpoint from the DSN | browser SDK sends telemetry directly to Sentry |
| `src/providers/posthog-provider.tsx` | `/ingest` on same origin, then rewrites to PostHog | browser traffic is intentionally proxied through the app boundary |
| `src/components/layout/footer.tsx` | Product Hunt widget image endpoint | external embed asset in the browser |
| `src/components/layout/footer.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx`, `src/app/blog/[slug]/page.tsx` | social/profile links | navigation, not API traffic, but still external browser destinations |

## Observations

- `fetch()` use is still split across many components rather than one shared frontend API client.
- Most browser calls are already aimed at local Next routes, which is a good target for later client abstraction.
- External provider calls should not be folded into the same abstraction as local backend API calls.

