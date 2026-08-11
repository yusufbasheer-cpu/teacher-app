import type { MetadataRoute } from "next";
import { posts } from "@/content/blog/posts";

const BASE = "https://layah.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    // Core product pages
    { url: `${BASE}/`,                        lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/lesson-plan`,             lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/question-paper`,          lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/differentiated-worksheets`, lastModified: new Date(), changeFrequency: "weekly",  priority: 0.9 },
    // Marketing & discovery
    { url: `${BASE}/pricing`,                 lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`,                   lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/blog`,                    lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    // Note: `/landing` is intentionally omitted — it's a legacy alias that
    // redirects to `/`, so listing both is duplicate content for search engines.
    { url: `${BASE}/faq`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`,                 lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/auth`,                    lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    // Legal
    { url: `${BASE}/privacy`,                 lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
    { url: `${BASE}/terms`,                   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.4 },
  ];

  // Blog posts are generated dynamically from posts.ts — adding a new post
  // there automatically includes it here with no manual sitemap update needed.
  const blogPostPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...blogPostPages];
}
