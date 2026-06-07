import type { Metadata, Viewport } from "next";
import { Caveat, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { AppEffects } from "@/components/effects/app-effects";
import { SoundProvider } from "@/components/effects/sound-provider";
import { ActiveSessionGuard } from "@/components/auth/active-session-guard";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";
import { SentryProvider } from "@/components/sentry-provider";
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

export const metadata: Metadata = {
  title: "Layah.ai",
  description:
    "Modern AI workspace for teachers to build lesson plans and classroom presentations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1628",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${caveat.variable} ${poppins.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
        style={{ color: "#0A1628" }}
      >
        <SentryProvider />
        <SoundProvider>
          <AppEffects />
          <NavbarWrapper />
          <ActiveSessionGuard>
            <PageTransitionWrapper>{children}</PageTransitionWrapper>
          </ActiveSessionGuard>
          <CookieBanner />
        </SoundProvider>
      </body>
    </html>
  );
}
