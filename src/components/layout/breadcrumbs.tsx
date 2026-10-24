import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export type Crumb = { name: string; href: string };

/** BreadcrumbList structured data. The last crumb is the current page. */
export function BreadcrumbJsonLd({ trail }: { trail: Crumb[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", href: "/" }, ...trail].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
  );
}

/** Visible breadcrumb (Home → … → current page) plus matching structured data. */
export function Breadcrumbs({ trail, className = "" }: { trail: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ name: "Home", href: "/" }, ...trail];
  return (
    <>
      <BreadcrumbJsonLd trail={trail} />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {all.map((c, i) => {
            const current = i === all.length - 1;
            return (
              <li key={c.href} className="flex min-w-0 items-center gap-2">
                {current ? (
                  <span aria-current="page" className="truncate">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="text-primary transition hover:underline">
                    {c.name}
                  </Link>
                )}
                {!current && <span aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
