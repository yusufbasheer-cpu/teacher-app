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
  title: "Layah – AI Lesson Planning for Teachers",
  description:
    "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
  metadataBase: new URL("https://layah.in"),
  openGraph: {
    title: "Layah – AI Lesson Planning for Teachers",
    description:
      "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
    url: "https://layah.in",
    siteName: "Layah",
    images: [
      {
        url: "/Logo.png",
        width: 512,
        height: 512,
        alt: "Layah logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Layah – AI Lesson Planning for Teachers",
    description:
      "Layah helps teachers create complete lesson plans, PPTs, worksheets and assessments using AI. Save hours every week. KHDA and SPEA aligned for UAE schools. Try free.",
    images: ["/Logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
      name: "Layah",
      url: "https://layah.in",
      logo: "https://layah.in/Logo.png",
      description:
        "AI-powered lesson planning and teaching resource generation platform for educators",
      sameAs: [
        "https://www.instagram.com/layah.teachers",
        "https://www.linkedin.com/company/layah-ai/",
        "https://x.com/layah_ai",
      ],
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
      url: "https://layah.in",
    },
  ];

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
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
      <body
        className={`${instrumentSans.variable} ${sourceSerif.variable} ${plexMono.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
      >
        <SentryProvider />
        <PostHogProvider>
          <AppShell>
            <ActiveSessionGuard>
              <PageTransitionWrapper>{children}</PageTransitionWrapper>
            </ActiveSessionGuard>
          </AppShell>
          <CookieBanner />
        </PostHogProvider>
        <Toaster />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
