import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/layout/breadcrumbs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Layah: how it works, supported curriculums, pricing and school plans, payments, uploads and account help for teachers.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: "FAQ", href: "/faq" }]} />
      {children}
    </>
  );
}
