import type { MetadataRoute } from "next";
import { SITE_URL, isIndexableDeployment } from "@/lib/site";

// Robots rules are a crawl hint, not access control: every private route below
// is also protected by authentication. Page-level `noindex` (login, signup,
// overview) is left crawlable on purpose so crawlers can see it.
export default function robots(): MetadataRoute.Robots {
  // Preview / staging deployments (incl. the experimental Gamma branch) must
  // never be indexed.
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/settings",
        "/my-lesson-plans",
        "/onboarding",
        "/school-admin",
        "/hod-dashboard",
        "/super-admin",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
