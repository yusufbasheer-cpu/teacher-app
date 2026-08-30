import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SchoolRegisterForm } from "@/components/school/school-register-form";

export const metadata: Metadata = {
  title: "Register Your School | Layah.ai",
  description:
    "Get unlimited AI lesson plans for every teacher. Register your school for a Layah School Plan.",
};

export default function SchoolRegisterPage() {
  return (
    <main
      className="min-h-screen pb-24 pt-10"
      style={{ background: "linear-gradient(180deg, var(--surface) 0%, var(--canvas) 35%, #ffffff 70%)" }}
    >
      <Container>
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <p
            className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "color-mix(in oklch, var(--brand) 12%, transparent)", color: "var(--brand)" }}
          >
            School Registration
          </p>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--text)" }}
          >
            Get <span className="font-layah-logo">Layah</span> for Your Entire School
          </h1>
          <p className="mt-3 text-base" style={{ color: "var(--text-secondary)" }}>
            Unlimited AI lesson plans, worksheets, and PPTs for every teacher.
          </p>
        </header>
        <SchoolRegisterForm />
      </Container>
    </main>
  );
}
