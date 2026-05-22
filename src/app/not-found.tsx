import Link from "next/link";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] pb-16 pt-16">
      <Container>
        <div className="mx-auto max-w-lg rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">404</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Page not found</h1>
          <p className="mt-3 text-sm text-slate-600">
            The link may be broken or the page was moved. Use the navigation above or go back to
            the home page.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Home
            </Link>
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-900 transition hover:bg-blue-50"
            >
              Lesson generator
            </Link>
            <Link
              href="/question-paper"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-900 transition hover:bg-blue-50"
            >
              Question Paper
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
