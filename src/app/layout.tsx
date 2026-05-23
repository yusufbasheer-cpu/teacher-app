import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { MarkerCursor } from "@/components/cursor/marker-cursor";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
        className={`${inter.variable} ${poppins.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
        style={{ color: "#0A1628" }}
      >
        <MarkerCursor />
        <NavbarWrapper />
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
      </body>
    </html>
  );
}
