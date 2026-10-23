import { BreadcrumbJsonLd } from "@/components/layout/breadcrumbs";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: "About", href: "/about" }]} />
      {children}
    </>
  );
}
