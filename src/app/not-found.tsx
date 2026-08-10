import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] pb-16 pt-16">
      <Container>
        <div className="mx-auto max-w-lg rounded-3xl border border-[#E3D9C8] bg-[#FAF6EF] p-8 text-center shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#0E9484]">404</p>
          <h1 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">Page not found</h1>
          <p className="mt-3 text-sm text-stone-600">
            The link may be broken or the page was moved. Use the navigation above or go back to
            the home page.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#241A12] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Home
            </Link>
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3D9C8] bg-[#FAF6EF] px-5 py-2.5 text-sm font-semibold text-[#241A12] transition hover:bg-[#F1E9DC]"
            >
              Lesson generator
            </Link>
            <Link
              href="/question-paper"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#E3D9C8] bg-[#FAF6EF] px-5 py-2.5 text-sm font-semibold text-[#241A12] transition hover:bg-[#F1E9DC]"
            >
              Question Paper
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
