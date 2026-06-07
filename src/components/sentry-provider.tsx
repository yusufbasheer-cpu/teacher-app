"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Client component that guarantees Sentry is initialised on every browser
 * page load — regardless of whether sentry.client.config.ts is executed by
 * the Next.js/Sentry webpack plugin.
 *
 * Mount once in the root layout; renders nothing.
 */
export function SentryProvider() {
  useEffect(() => {
    if (!Sentry.isInitialized()) {
      Sentry.init({
        dsn: "https://62c1790b97dbb204d2709c0d1602a813@o4511506447794176.ingest.us.sentry.io/4511506454740992",
        tracesSampleRate: 0.1,
        enabled: true,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
          Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
      });
      console.log("[Sentry] initialized via SentryProvider");
    } else {
      console.log("[Sentry] already initialized");
    }
  }, []);

  return null;
}
