import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/marketing/section-label";
import { posts, formatDate } from "@/content/blog/posts";

export const metadata: Metadata = {
  title: "Blog – Teaching Tips & AI Resources | Layah",
  description:
    "Practical articles for teachers on lesson planning, AI tools, KHDA frameworks, and saving time in the classroom. Written by educators, for educators.",
};

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
    <div className="site-editorial min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-navy pb-16 pt-20">
        <Container>
          <SectionLabel>Layah blog</SectionLabel>
          <h1 className="font-display mt-4 text-4xl font-semibold tracking-tight text-chalk sm:text-5xl">
            Teaching tips &amp; AI resources
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-chalk/65">
            Practical articles for educators on lesson planning, AI tools, KHDA frameworks, and reclaiming your time.
          </p>
        </Container>
      </div>

      {/* Post grid */}
      <Container className="py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
              <Card className="h-full gap-0 overflow-hidden border-border py-0 shadow-none transition hover:shadow-md">
                <div className="h-40 w-full flex-shrink-0" style={{ background: post.coverGradient }} />
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-lg font-semibold leading-snug text-navy transition group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono-editorial text-[0.7rem] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ClockIcon />
                      {post.readTime} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon />
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition group-hover:gap-2">
                    Read article →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Container>

      <Footer />
    </div>
  );
}
