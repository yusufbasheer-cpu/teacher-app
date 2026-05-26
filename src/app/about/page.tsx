import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "About Layah — Our Story & Mission",
  description:
    "Layah was built by a teacher for teachers. Learn about our mission to save teachers time with AI-powered lesson planning tools.",
};

const NAVY = "#0A1628";
const TEAL = "#00C6A7";

const OFFERINGS = [
  {
    title: "Lesson Plans",
    description: "Complete, curriculum-aligned lesson plans generated in seconds with proper structure and pedagogy.",
    icon: (
      <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "PPT Presentations",
    description: "Beautiful, structured PowerPoint slides with AFL tool integration — ready to present in class.",
    icon: (
      <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
  },
  {
    title: "Question Papers",
    description: "Structured assessments and question papers tailored to your curriculum, subject, and grade level.",
    icon: (
      <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: "Activity Sheet AFL",
    description: "31 Assessment for Learning tools across six lesson phases — printable, student-facing activity sheets.",
    icon: (
      <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
];

const VALUES = [
  { title: "Affordable", description: "Free to start, with fair pricing that respects teacher budgets." },
  { title: "Teacher First", description: "Every feature is designed around real classroom needs, not tech trends." },
  { title: "Curriculum Aligned", description: "Supporting 15+ curricula worldwide — UAE, CBSE, British, American, and more." },
  { title: "Always Improving", description: "We listen to teacher feedback and ship improvements every week." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F7F9FC", color: NAVY }}>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: NAVY }}>
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 30% 50%, ${TEAL}33, transparent 60%)` }} />
        <Container>
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.15)", color: TEAL }}>
              About Layah
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl" style={{ fontWeight: 700 }}>
              Empowering teachers worldwide with AI-powered lesson planning tools
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
              Built by a teacher, for teachers — because your time is better spent inspiring students, not formatting documents.
            </p>
          </div>
        </Container>
      </section>

      {/* Our Story */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}>
              Our Story
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
              Built by a teacher, for teachers
            </h2>
            <p className="mt-6 text-base leading-relaxed" style={{ color: "#4A5568" }}>
              Layah was born from a simple frustration: teachers spend too many hours planning lessons, creating resources, and formatting documents — time that could be spent with students. As a teacher, our founder experienced this firsthand and decided to build a solution.
            </p>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "#4A5568" }}>
              Using the power of AI, Layah generates complete lesson plans, beautiful presentations, worksheets, assessments, and activity sheets in minutes — all aligned to the curriculum you teach. What started as a personal tool has grown into a platform trusted by teachers across the globe.
            </p>
          </div>
        </Container>
      </section>

      {/* Our Mission */}
      <section className="py-16 sm:py-20" style={{ background: "white" }}>
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}>
              Our Mission
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
              To save teachers time so they can focus on what matters most — their students
            </h2>
            <p className="mt-6 text-base leading-relaxed" style={{ color: "#4A5568" }}>
              We believe every teacher deserves tools that make planning easier, faster, and more effective. Layah exists so you can walk into the classroom confident, prepared, and with time left over for what truly matters — connecting with your students.
            </p>
          </div>
        </Container>
      </section>

      {/* What We Offer */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}>
              What We Offer
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
              Everything a teacher needs, in one place
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {OFFERINGS.map((item) => (
              <div key={item.title} className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md" style={{ borderColor: "rgba(0,198,167,0.15)" }}>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl" style={{ background: "rgba(0,198,167,0.1)", color: TEAL }}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold" style={{ color: NAVY }}>{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#4A5568" }}>{item.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Our Values */}
      <section className="py-16 sm:py-20" style={{ background: "white" }}>
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}>
              Our Values
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
              What drives us every day
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "#E2E8F0" }}>
                <h3 className="text-lg font-semibold" style={{ color: TEAL }}>{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#4A5568" }}>{value.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Team */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}>
              Our Team
            </p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
              The people behind Layah
            </h2>
          </div>
          <div className="mx-auto max-w-xs">
            <div className="rounded-2xl border bg-white p-8 text-center shadow-sm" style={{ borderColor: "rgba(0,198,167,0.15)" }}>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
                Y
              </div>
              <h3 className="mt-5 text-lg font-semibold" style={{ color: NAVY }}>Yusuf</h3>
              <p className="mt-1 text-sm" style={{ color: TEAL }}>Founder &amp; Teacher</p>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#4A5568" }}>
                A passionate educator who built Layah to solve the planning challenges he faced every day in the classroom.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* Contact CTA */}
      <section className="py-16 sm:py-20" style={{ background: `linear-gradient(135deg, ${TEAL}, #0A8F7A)` }}>
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Get in touch</h2>
            <p className="mt-4 text-base text-white/80">
              Have questions, feedback, or want to bring Layah to your school? We would love to hear from you.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-white px-8 py-3 text-sm font-semibold shadow-lg transition hover:bg-slate-50"
                style={{ color: "#0A8F7A" }}
              >
                Contact Us
              </Link>
              <a
                href="mailto:info@layah.in"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                info@layah.in
              </a>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
