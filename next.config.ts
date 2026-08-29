import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for hydration scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://checkout.razorpay.com https://cdn.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  // Images: self, data URIs, blobs, and any HTTPS source (Pexels, fal.ai CDN, etc.)
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // API connections: Supabase, DeepSeek, fal.ai, ipapi, Sentry, Razorpay.
  // cdn.razorpay.com is Razorpay's risk/fraud-detection bundle, pulled by
  // checkout.js into OUR page context (not their iframe), so it needs both a
  // script-src entry above and a connect-src entry here - without them the CSP
  // silently blocked fraud detection on every checkout.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.deepseek.com https://rest.fal.run https://fal.run https://queue.fal.run https://ipapi.co https://api.country.is https://api.pexels.com https://*.sentry.io https://sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com https://api.razorpay.com https://lumberjack.razorpay.com https://cdn.razorpay.com",
  // Workers: blob: required by Sentry replay and other browser workers
  "worker-src blob: 'self'",
  // Razorpay's checkout overlay renders card/3DS/OTP steps in an iframe from these origins
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com",
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
  // posthog-js posts to /ingest/e/ and /ingest/i/v0/e/ WITH a trailing slash;
  // without this, Next 308-redirects those away and every event pays an extra
  // round trip (verified locally - it returned 308, not 200, before this line).
  skipTrailingSlashRedirect: true,
  // PostHog is served through this app's own origin at /ingest, because ad
  // blockers match on the us.i.posthog.com hostname and were silently dropping
  // analytics events for a large share of teachers. Proxying makes the requests
  // first-party, so the existing "connect-src 'self'" / "script-src 'self'"
  // directives in CSP above already cover them - no CSP change needed.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
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
