import * as Sentry from "@sentry/nextjs";
import { browserEnvironment, shouldSendTelemetry } from "@/lib/telemetry-env";

/**
 * Browser-side Sentry setup.
 *
 * This file, not `sentry.client.config.ts`, is the client entry point on
 * Next 15+/16 — the old filename is no longer picked up, which is easy to miss
 * because nothing errors: `NEXT_PUBLIC_SENTRY_DSN` is set for Preview and
 * Production, so the SDK just auto-initialised itself with defaults and kept
 * reporting. That was visible in the envelopes as `environment: "vercel-preview"`
 * (the SDK's own `vercel-${VERCEL_ENV}` default) rather than any value this
 * codebase sets.
 *
 * Production only, so staging testing does not land in the same project as real
 * incidents. `environment` is set either way so anything re-enabled outside
 * production stays filterable.
 */
Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    "https://62c1790b97dbb204d2709c0d1602a813@o4511506447794176.ingest.us.sentry.io/4511506454740992",
  environment: browserEnvironment(),
  enabled: shouldSendTelemetry(),
  tracesSampleRate: 0.1,
  debug: false,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ["password", "token", "apiKey", "secret"]) {
        if (key in data) data[key] = "[Filtered]";
      }
    }
    return event;
  },
});

// Required on Next 15+ for navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
