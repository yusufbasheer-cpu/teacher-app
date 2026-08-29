import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Caveat, IBM_Plex_Mono, Plus_Jakarta_Sans, Poppins, Space_Grotesk } from "next/font/google";
import { ActiveSessionGuard } from "@/components/auth/active-session-guard";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { AppShell } from "@/components/layout/app-shell";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";
import { SentryProvider } from "@/components/sentry-provider";
import { PostHogProvider } from "@/providers/posthog-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "600", "700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

// Marketing-pages-only typography (see docs/architecture.md §6 — no nested
// layout.tsx exists, so fonts load globally here but are only applied via
// font-display/font-mono-editorial classes on the `/` homepage, /about,
// /pricing, /faq, /blog routes).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
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
  themeColor: "#241A12",
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
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${caveat.variable} ${poppins.variable} ${spaceGrotesk.variable} ${plexMono.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
        style={{ color: "#241A12" }}
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
