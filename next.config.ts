import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@fal-ai/client"],
};

export default nextConfig;
