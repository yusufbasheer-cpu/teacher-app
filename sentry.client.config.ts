import * as Sentry from "@sentry/nextjs";
import { browserEnvironment, shouldSendTelemetry } from "@/lib/telemetry-env";

/**
 * Error reporting sends from production only.
 *
 * This used to be `enabled: true` with no `environment`, so errors raised while
 * testing a staging deploy arrived in the same Sentry project as real incidents
 * and — because @sentry/nextjs defaults `environment` to NODE_ENV, which is
 * "production" for every Vercel build including previews — were tagged as
 * production. There was no way to tell a teacher's crash from our own testing.
 *
 * `environment` is set regardless of whether sending is on, so that if it is
 * ever re-enabled outside production the events are at least filterable.
 */
Sentry.init({
  dsn: "https://62c1790b97dbb204d2709c0d1602a813@o4511506447794176.ingest.us.sentry.io/4511506454740992",
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
