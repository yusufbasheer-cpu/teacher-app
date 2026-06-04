import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV === "production" ? "production" : "development",

  // Capture 10 % of transactions — API routes included automatically.
  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === "production",

  beforeSend(event) {
    // Strip secrets that may appear in server-side error payloads.
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ["password", "token", "apiKey", "secret", "service_role"]) {
        if (key in data) data[key] = "[Filtered]";
      }
    }
    return event;
  },
});
