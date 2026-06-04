import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV === "production" ? "production" : "development",

  // Capture 10 % of transactions to stay within quota.
  tracesSampleRate: 0.1,

  // Replay 10 % of sessions; 100 % of sessions with an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Do not send errors in development to keep DSN quota clean.
  enabled: process.env.NODE_ENV === "production",

  beforeSend(event) {
    // Strip sensitive form fields from breadcrumbs before sending.
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ["password", "token", "apiKey", "secret"]) {
        if (key in data) data[key] = "[Filtered]";
      }
    }
    return event;
  },
});
