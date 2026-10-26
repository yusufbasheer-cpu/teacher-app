import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Instrument_Sans, Source_Serif_4 } from "next/font/google";
import { ActiveSessionGuard } from "@/components/auth/active-session-guard";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { AppShell } from "@/components/layout/app-shell";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";
import { SentryProvider } from "@/components/sentry-provider";
import { PostHogProvider } from "@/providers/posthog-provider";
import { Toaster } from "@/components/ui/toaster";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { CONTACT_EMAIL, OG_IMAGE, SITE_NAME, SITE_URL, SOCIAL_PROFILES, absoluteUrl } from "@/lib/site";
import "./globals.css";

/* Three faces, three jobs — see the type-role note in globals.css.
   This replaces five families (Plus Jakarta, Poppins, Caveat, Space Grotesk,
   Plex Mono) that were all loading on every route while only ever being used
   on a subset of them. */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Generated artifact content only (lesson plans, worksheets, papers).
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600"],
  display: "swap",
});

// Data and machine facts: period numbers, quotas, dates, keyboard shortcuts.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  // Pages set a bare name ("Pricing"); the template adds the brand.
  title: { default: "Layah – AI Lesson Planning for Teachers", template: "%s | Layah" },
  description:
    "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
  metadataBase: new URL(SITE_URL),
  // "./" resolves against each page's own path, so every page self-canonicalises
  // on the www host with query strings (utm_*, ?ref=) and trailing slashes dropped.
  alternates: { canonical: "./" },
  // Search Console meta-tag verification, only if the owner sets the token.
  // (The HTML-file method via public/google*.html is already in place.)
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  openGraph: {
    title: "Layah – AI Lesson Planning for Teachers",
    description:
      "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
    url: "./",
    siteName: SITE_NAME,
    images: [OG_IMAGE],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Layah – AI Lesson Planning for Teachers",
    description:
      "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) report real values on notched / home-indicator
  // devices; fixed chrome pads itself with them. Zero on other devices.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#181c1e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/Logo.png"),
      description:
        "AI-powered lesson planning and teaching resource generation platform for educators",
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: CONTACT_EMAIL },
      sameAs: [...SOCIAL_PROFILES],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Layah",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description:
        "AI-powered platform that generates complete lesson plans, PowerPoint presentations, worksheets, question papers, and differentiated resources for teachers",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free plan available",
      },
      url: SITE_URL,
    },
  ];

  return (
    // The font variables must live on <html>, not <body>: `--font-sans` is
    // composed from them at :root by the @theme block in globals.css, and a
    // var() only defined further down the tree resolves to nothing there —
    // which silently drops the whole stack to Times.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Resolve the theme before first paint. Without this the page paints
            light and then flips, which is worse than no dark mode at all for
            the night-time planning session this feature exists for. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("layah:theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-w-0 overflow-x-hidden font-sans antialiased">
        <SentryProvider />
        <PostHogProvider>
          <AppShell>
            <ActiveSessionGuard>
              <PageTransitionWrapper>{children}</PageTransitionWrapper>
            </ActiveSessionGuard>
          </AppShell>
          <CookieBanner />
        </PostHogProvider>
        <GoogleAnalytics />
        <Toaster />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
