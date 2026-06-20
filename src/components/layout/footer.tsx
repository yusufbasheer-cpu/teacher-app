import Link from "next/link";
import { Container } from "@/components/ui/container";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

function InstagramIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const COMPANY_LINKS = [
  { label: "About Layah", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

const FEATURE_LINKS = [
  { label: "Lesson Plan Generator", href: "/lesson-plan" },
  { label: "PPT Generator", href: "/lesson-plan" },
  { label: "Question Paper Generator", href: "/question-paper" },
  { label: "Activity Sheet AFL", href: "/lesson-plan" },
];

const SUPPORT_LINKS = [
  { label: "FAQs", href: "/faq" },
  { label: "School Plans", href: "/pricing" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/layah.teachers?igsh=NHAwOGFoaXNkc2hh&utm_source=qr", icon: InstagramIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/layah-ai/", icon: LinkedInIcon },
  { label: "X (Twitter)", href: "https://x.com/layah_ai", icon: XIcon },
];

function FooterLinkGroup({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: TEAL }}>
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((link) => {
          const isExternal = link.href.startsWith("mailto:") || link.href.startsWith("http");
          return (
            <li key={link.label}>
              {isExternal ? (
                <a
                  href={link.href}
                  className="inline-flex min-h-[44px] items-center py-1 text-sm transition hover:opacity-100"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="inline-flex min-h-[44px] items-center py-1 text-sm transition hover:opacity-100"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {link.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer style={{ background: NAVY }}>
      <Container className="pb-8 pt-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center">
              <img
                src="/Logo.png"
                alt="Layah"
                height={36}
                className="h-9 w-auto"
                style={{ height: 36, width: "auto" }}
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              AI-powered lesson planning for teachers worldwide. Generate complete lesson plans, PPTs, worksheets, and more in minutes.
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:opacity-100"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                >
                  <social.icon />
                </a>
              ))}
            </div>
          </div>

          <FooterLinkGroup title="Company" links={COMPANY_LINKS} />
          <FooterLinkGroup title="Features" links={FEATURE_LINKS} />
          <FooterLinkGroup title="Support" links={SUPPORT_LINKS} />
        </div>

        <div
          className="mt-12 flex flex-col items-center gap-2 border-t pt-6 text-center sm:flex-row sm:justify-between"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            &copy; 2026 Layah. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Made with love for teachers worldwide
          </p>
        </div>
      </Container>
    </footer>
  );
}
