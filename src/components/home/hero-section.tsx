import Link from "next/link";
import { Container } from "@/components/ui/container";

export function HeroSection() {
  return (
    <section
      className="pt-10 pb-12 md:pt-16"
      style={{ background: "#F7F9FC" }}
    >
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p
            className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
            style={{ borderColor: "#00C6A7", color: "#00C6A7", background: "rgba(0,198,167,0.08)" }}
          >
            Built for modern classrooms
          </p>
          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "#0A1628" }}
          >
            Beautiful AI planning tools for modern teachers.
          </h1>
          <p className="mt-5 max-w-xl text-lg" style={{ color: "#4A5568" }}>
            Layah.ai helps teachers generate lesson plans, save them securely, and download
            polished classroom presentations in minutes.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/lesson-plan"
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: "#00C6A7" }}
            >
              Generate Lesson Plan
            </Link>
            <Link
              href="/auth"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border px-5 py-3 text-center text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: "#00C6A7", color: "#00C6A7", background: "transparent" }}
            >
              Sign in
            </Link>
            <Link
              href="#features"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border px-5 py-3 text-center text-sm font-semibold transition hover:bg-slate-100"
              style={{ borderColor: "#CBD5E0", color: "#4A5568" }}
            >
              Explore Features
            </Link>
          </div>
        </div>

        <div
          className="rounded-3xl border bg-white p-6 shadow-sm md:p-7"
          style={{ borderColor: "rgba(0,198,167,0.2)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "#0A1628" }}>
            Today&apos;s Lesson Snapshot
          </h2>
          <div className="mt-5 space-y-4 text-sm" style={{ color: "#4A5568" }}>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "rgba(0,198,167,0.2)", background: "rgba(0,198,167,0.05)" }}
            >
              <p className="font-medium" style={{ color: "#0A1628" }}>Grade 7 Science</p>
              <p className="mt-1">Topic: Photosynthesis</p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "rgba(0,198,167,0.2)", background: "rgba(0,198,167,0.05)" }}
            >
              <p className="font-medium" style={{ color: "#0A1628" }}>Objectives</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Explain key photosynthesis stages</li>
                <li>Compare sunlight and chlorophyll roles</li>
                <li>Create a concept map activity</li>
              </ul>
            </div>
            <div
              className="rounded-xl p-4 text-white"
              style={{ background: "#0A1628" }}
            >
              PowerPoint outline generated: 10 slides
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
