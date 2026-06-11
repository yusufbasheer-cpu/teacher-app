import Link from "next/link";
import { Container } from "@/components/ui/container";

export function HeroSection() {
  return (
    <section className="pb-16 pt-12 md:pb-24 md:pt-20" style={{ background: "#FFFFFF" }}>
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold"
            style={{ borderColor: "#00C6A7", color: "#00C6A7", background: "rgba(0,198,167,0.08)" }}
          >
            <span>🎉</span> Built for modern classrooms
          </p>
          <h1
            className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "#0A1628" }}
          >
            Your AI teaching assistant is here 🎓
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "#374151" }}>
            Layah helps teachers generate beautiful lesson plans, question papers, and classroom
            presentations — in minutes, not hours.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:opacity-90 hover:shadow-md"
              style={{ background: "#00C6A7" }}
            >
              Generate Lesson Plan ✨
            </Link>
            <Link
              href="/question-paper"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border px-6 py-3 text-center text-sm font-semibold transition hover:bg-teal-50"
              style={{ borderColor: "#00C6A7", color: "#00C6A7" }}
            >
              Question Paper
            </Link>
            <Link
              href="/auth"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border px-6 py-3 text-center text-sm font-semibold transition hover:bg-gray-50"
              style={{ borderColor: "#E5E7EB", color: "#374151" }}
            >
              Sign in free →
            </Link>
          </div>
          <p className="mt-5 text-xs font-medium" style={{ color: "#9CA3AF" }}>
            No credit card needed · 15 free generations every month
          </p>
        </div>

        <div
          className="rounded-2xl border bg-white p-6 shadow-lg transition hover:shadow-xl md:p-7"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-2 text-xs font-medium" style={{ color: "#9CA3AF" }}>Layah AI · Generating...</span>
          </div>
          <h2 className="text-base font-bold" style={{ color: "#0A1628" }}>
            📋 Today&apos;s Lesson Snapshot
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div
              className="rounded-xl p-4"
              style={{ background: "#F0FDFB", border: "1px solid rgba(0,198,167,0.2)" }}
            >
              <p className="font-semibold" style={{ color: "#0A1628" }}>
                🔬 Grade 7 Science
              </p>
              <p className="mt-1" style={{ color: "#374151" }}>Topic: Photosynthesis</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
            >
              <p className="font-semibold" style={{ color: "#0A1628" }}>🎯 Objectives</p>
              <ul className="mt-2 space-y-1 pl-4" style={{ color: "#374151" }}>
                <li>✓ Explain key photosynthesis stages</li>
                <li>✓ Compare sunlight and chlorophyll roles</li>
                <li>✓ Create a concept map activity</li>
              </ul>
            </div>
            <div
              className="rounded-xl p-4 font-semibold"
              style={{ background: "#0A1628", color: "#00C6A7" }}
            >
              🖥️ PowerPoint outline ready · 10 slides
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
