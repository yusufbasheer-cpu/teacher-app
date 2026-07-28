import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for hydration scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  // Images: self, data URIs, blobs, and any HTTPS source (Pexels, fal.ai CDN, etc.)
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // API connections: Supabase, DeepSeek, fal.ai, ipapi, Sentry
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.deepseek.com https://rest.fal.run https://fal.run https://queue.fal.run https://ipapi.co https://api.country.is https://api.pexels.com https://*.sentry.io https://sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com",
  // Workers: blob: required by Sentry replay and other browser workers
  "worker-src blob: 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@fal-ai/client"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation and project (from sentry.io → Settings → Projects).
  // Leave as empty strings if not using source-map uploads (they're optional).
  org: process.env.SENTRY_ORG ?? "",
  project: process.env.SENTRY_PROJECT ?? "",

  // Auth token for source-map uploads — add SENTRY_AUTH_TOKEN to env if desired.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Keep build output quiet; set to false to debug Sentry webpack plugin.
  silent: true,

  // Upload source maps only in CI / production builds, not local dev.
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  // Wrap API routes with Sentry so unhandled errors are captured automatically.
  autoInstrumentServerFunctions: true,

  // Tree-shake Sentry debug logging from the client bundle.
  disableLogger: true,

});
