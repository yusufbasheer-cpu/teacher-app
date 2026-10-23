import type { MetadataRoute } from "next";
import { posts } from "@/content/blog/posts";
import { absoluteUrl } from "@/lib/site";

// Public, indexable, canonical pages only. `lastModified` is set only where a
// real date exists (blog posts); static pages omit it rather than claim
// "modified now" on every build. `/landing` is a redirect to `/`, and the
// generators, login and signup need an account, so none are listed.
const STATIC_PATHS = ["/", "/pricing", "/about", "/blog", "/faq", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) }));

  // Adding a post to posts.ts adds it here automatically.
  const blogPostPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.publishedAt),
  }));

  return [...staticPages, ...blogPostPages];
}
