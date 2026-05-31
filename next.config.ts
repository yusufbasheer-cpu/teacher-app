import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for hydration scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Images: self, data URIs, blobs, and any HTTPS source (Pexels, fal.ai CDN, etc.)
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // API connections: Supabase, DeepSeek, fal.ai, ipapi
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.deepseek.com https://rest.fal.run https://fal.run https://queue.fal.run https://ipapi.co https://api.country.is https://api.pexels.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@fal-ai/client"],
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

export default nextConfig;
