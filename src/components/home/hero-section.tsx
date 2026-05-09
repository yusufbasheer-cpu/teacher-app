import Link from "next/link";
import { Container } from "@/components/ui/container";

export function HeroSection() {
  return (
    <section className="pt-10 pb-12 md:pt-16">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-4 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            Built for modern classrooms
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Beautiful AI planning tools for modern teachers.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">
            EduPlan AI helps teachers generate lesson plans, save them securely, and
            download polished classroom presentations in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/lesson-plan"
              className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Generate Lesson Plan
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300"
            >
              Explore Features
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm md:p-7">
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Lesson Snapshot</h2>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-medium text-slate-800">Grade 7 Science</p>
              <p className="mt-1">Topic: Photosynthesis</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="font-medium text-slate-800">Objectives</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Explain key photosynthesis stages</li>
                <li>Compare sunlight and chlorophyll roles</li>
                <li>Create a concept map activity</li>
              </ul>
            </div>
            <div className="rounded-xl bg-blue-700 p-4 text-blue-50">
              PowerPoint outline generated: 10 slides
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
