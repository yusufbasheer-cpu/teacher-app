import type { MetadataRoute } from "next";

const BASE = "https://layah.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/settings",
        "/school-admin",
        "/hod-dashboard",
        "/super-admin",
        "/auth/callback",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
