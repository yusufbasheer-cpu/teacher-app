import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { MarkerCursor } from "@/components/cursor/marker-cursor";
import { AppEffects } from "@/components/effects/app-effects";
import { SoundProvider } from "@/components/effects/sound-provider";
import { ActiveSessionGuard } from "@/components/auth/active-session-guard";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en" className="overflow-x-hidden">
      <body
        className={`${plusJakartaSans.variable} ${poppins.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
        style={{ color: "#0A1628" }}
      >
        <SoundProvider>
          <MarkerCursor />
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
