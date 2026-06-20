import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import { posts, formatDate } from "@/content/blog/posts";

export const metadata: Metadata = {
  title: "Blog – Teaching Tips & AI Resources | Layah",
  description:
    "Practical articles for teachers on lesson planning, AI tools, KHDA frameworks, and saving time in the classroom. Written by educators, for educators.",
};

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

function ClockIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function BlogPage() {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <>
      <main style={{ background: "#F9FAFB", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ background: NAVY }} className="pb-16 pt-20">
          <Container>
            <p
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold"
              style={{ borderColor: TEAL, color: TEAL, background: "rgba(0,198,167,0.1)" }}
            >
              Layah Blog
            </p>
            <h1
              className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
            >
              Teaching tips &amp; AI resources
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              Practical articles for educators on lesson planning, AI tools, KHDA frameworks, and reclaiming your time.
            </p>
          </Container>
        </div>

        {/* Post grid */}
        <Container className="py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: "#E5E7EB" }}
              >
                {/* Cover placeholder */}
                <div
                  className="h-48 w-full flex-shrink-0"
                  style={{ background: post.coverGradient }}
                />

                {/* Card body */}
                <div className="flex flex-1 flex-col p-6">
                  <h2
                    className="text-lg font-bold leading-snug transition group-hover:opacity-80"
                    style={{ color: NAVY }}
                  >
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "#6B7280" }}>
                    {post.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: "#9CA3AF" }}>
                    <span className="flex items-center gap-1">
                      <ClockIcon />
                      {post.readTime} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>

                  <span
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition group-hover:gap-2"
                    style={{ color: TEAL }}
                  >
                    Read article →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
