import * as Sentry from "@sentry/nextjs";
import { serverEnvironment } from "@/lib/runtime-env";

// Production only — see sentry.server.config.ts.
Sentry.init({
  dsn: "https://62c1790b97dbb204d2709c0d1602a813@o4511506447794176.ingest.us.sentry.io/4511506454740992",
  environment: serverEnvironment(),
  enabled: serverEnvironment() === "production",
  tracesSampleRate: 0.1,
  debug: false,
});
