import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/marketing/section-label";
import { posts, getPostBySlug, formatDate, type ContentBlock } from "@/content/blog/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Layah Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://layah.in/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={index} className="font-display mb-3 mt-10 text-2xl font-semibold leading-snug text-navy first:mt-0">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={index} className="font-display mb-2 mt-7 text-xl font-semibold leading-snug text-navy">
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p key={index} className="mb-5 leading-relaxed text-foreground/85">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={index} className="mb-5 space-y-2 pl-5 text-foreground/85">
          {block.items.map((item, i) => (
            <li key={i} className="relative list-disc pl-2 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={index} className="mb-5 space-y-2 pl-5 text-foreground/85">
          {block.items.map((item, i) => (
            <li key={i} className="relative list-decimal pl-2 leading-relaxed">
              {item}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={index} className="mb-5 rounded-lg border-l-4 border-primary bg-primary/5 py-4 pl-5 pr-4 italic text-foreground/85">
          &ldquo;{block.text}&rdquo;
        </blockquote>
      );
  }
}

function ShareButton({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
    >
      {children}
    </a>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const postUrl = `https://layah.in/blog/${post.slug}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;

  return (
    <div className="site-editorial min-h-screen bg-background text-foreground">
      {/* Cover */}
      <div className="h-56 w-full md:h-72" style={{ background: post.coverGradient }} />

      {/* Article */}
      <Container className="pb-20">
        <article className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 pb-6 pt-8 text-sm text-muted-foreground">
            <Link href="/blog" className="text-primary transition hover:underline">
              Blog
            </Link>
            <span>/</span>
            <span className="truncate">{post.title}</span>
          </div>

          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            {post.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy font-mono-editorial text-xs font-medium text-chalk">
                {post.author.split(" ").map((n) => n[0]).join("")}
              </span>
              {post.author}
            </span>
            <span>{formatDate(post.publishedAt)}</span>
            <span>{post.readTime} min read</span>
          </div>

          <div className="mt-8 text-base">{post.content.map((block, i) => renderBlock(block, i))}</div>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <span className="text-sm font-medium text-muted-foreground">Share:</span>
            <ShareButton href={twitterShareUrl} label="Share on X (Twitter)">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X / Twitter
            </ShareButton>
            <ShareButton href={linkedInShareUrl} label="Share on LinkedIn">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
              LinkedIn
            </ShareButton>
          </div>

          {/* CTA */}
          <div className="mt-12 rounded-xl bg-navy px-8 py-10 text-center">
            <SectionLabel className="justify-center flex">Ready to save hours every week?</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold text-chalk">
              Try Layah free — no credit card needed
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-chalk/65">
              Generate your first complete lesson plan, PPT, and worksheet pack in under 5 minutes.
            </p>
            <Link href="/signup" className={buttonVariants({ size: "lg", className: "mt-6 h-11 rounded-lg px-8" })}>
              Try Layah free →
            </Link>
          </div>

          <div className="mt-10 text-center">
            <Link href="/blog" className="text-sm font-medium text-primary transition hover:underline">
              ← Back to all articles
            </Link>
          </div>
        </article>
      </Container>

      <Footer />
    </div>
  );
}
