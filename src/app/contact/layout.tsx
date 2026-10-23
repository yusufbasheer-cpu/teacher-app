import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/layout/breadcrumbs";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions about Layah, school plans or your account? Send us a message or email info@layah.in. Our team replies within 24 hours, Monday to Friday.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: "Contact", href: "/contact" }]} />
      {children}
    </>
  );
}
