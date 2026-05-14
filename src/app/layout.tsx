import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { NavbarWrapper } from "@/components/layout/navbar-wrapper";
import "./globals.css";

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
        className={`${poppins.variable} min-w-0 overflow-x-hidden font-sans antialiased`}
        style={{ color: "#0A1628" }}
      >
        <NavbarWrapper />
        {children}
      </body>
    </html>
  );
}
