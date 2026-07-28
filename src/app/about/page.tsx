import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/marketing/section-label";

export const metadata: Metadata = {
  title: "About Layah — Our Story & Mission",
  description:
    "Layah was built by a teacher for teachers. Learn about our mission to save teachers time with AI-powered lesson planning tools.",
};

const OFFERINGS = [
  {
    title: "Lesson plans",
    description: "Complete, curriculum-aligned lesson plans generated in seconds with proper structure and pedagogy.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    ),
  },
  {
    title: "PPT presentations",
    description: "Beautiful, structured PowerPoint slides with AFL tool integration — ready to present in class.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
    ),
  },
  {
    title: "Question papers",
    description: "Structured assessments and question papers tailored to your curriculum, subject, and grade level.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    ),
  },
  {
    title: "Activity Sheet AFL",
    description: "31 Assessment for Learning tools across six lesson phases — printable, student-facing activity sheets.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    ),
  },
];

const VALUES = [
  { title: "Affordable", description: "Free to start, with fair pricing that respects teacher budgets." },
  { title: "Teacher first", description: "Every feature is designed around real classroom needs, not tech trends." },
  { title: "Curriculum aligned", description: "Supporting 15+ curricula worldwide — UAE, CBSE, British, American, and more." },
  { title: "Always improving", description: "We listen to teacher feedback and ship improvements every week." },
];

function OfferingIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      {children}
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className="site-editorial min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="bg-navy py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel className="justify-center flex">About Layah</SectionLabel>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-chalk sm:text-5xl">
              Built for teachers who don&apos;t have hours to spare
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-chalk/65">
              Built by a teacher, for teachers — because your time is better spent inspiring students, not formatting documents.
            </p>
          </div>
        </Container>
      </section>

      {/* Our Story */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel className="justify-center flex">Our story</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Built by a teacher, for teachers
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              Layah was born from a simple frustration: teachers spend too many hours planning lessons, creating resources, and formatting documents — time that could be spent with students. As a teacher, our founder experienced this firsthand and decided to build a solution.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Using the power of AI, Layah generates complete lesson plans, presentations, worksheets, assessments, and activity sheets in minutes — all aligned to the curriculum you teach. What started as a personal tool has grown into a platform trusted by teachers across the globe.
            </p>
          </div>
        </Container>
      </section>

      {/* Our Mission */}
      <section className="border-t border-border py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel className="justify-center flex">Our mission</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              To save teachers time so they can focus on what matters most
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              We believe every teacher deserves tools that make planning easier, faster, and more effective. Layah exists so you can walk into the classroom confident, prepared, and with time left over for what truly matters — connecting with your students.
            </p>
          </div>
        </Container>
      </section>

      {/* What We Offer */}
      <section className="border-t border-border py-16 sm:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel className="justify-center flex">What we offer</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Everything a teacher needs, in one place
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
            {OFFERINGS.map((item) => (
              <Card key={item.title} className="border-border shadow-none transition hover:shadow-md">
                <CardContent>
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <OfferingIcon>{item.icon}</OfferingIcon>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Our Values */}
      <section className="border-t border-border py-16 sm:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel className="justify-center flex">Our values</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              What drives us every day
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
            {VALUES.map((value) => (
              <Card key={value.title} className="border-border shadow-none">
                <CardContent>
                  <h3 className="font-display text-lg font-semibold text-primary">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Team */}
      <section className="border-t border-border py-16 sm:py-20">
        <Container>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel className="justify-center flex">Our team</SectionLabel>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              The people behind Layah
            </h2>
          </div>
          <Card className="mx-auto max-w-xs border-border py-8 text-center shadow-none">
            <CardContent>
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-navy font-display text-lg font-semibold text-chalk">
                MY
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy">Mohammed Yusuf</h3>
              <p className="mt-1 text-sm text-primary">Founder &amp; Teacher</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A passionate educator who built Layah to solve the planning challenges he faced every day in the classroom.
              </p>
              <a
                href="https://www.linkedin.com/company/layah-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
                Follow on LinkedIn
              </a>
            </CardContent>
          </Card>
        </Container>
      </section>

      {/* Contact CTA */}
      <section className="bg-navy py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold text-chalk sm:text-3xl">Get in touch</h2>
            <p className="mt-4 text-base text-chalk/70">
              Have questions, feedback, or want to bring Layah to your school? We would love to hear from you.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/contact" className={buttonVariants({ size: "lg", className: "h-11 rounded-lg px-8" })}>
                Contact us
              </Link>
              <a
                href="mailto:info@layah.in"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "h-11 rounded-lg border-chalk/25 bg-transparent px-8 text-chalk hover:bg-chalk/10 hover:text-chalk",
                })}
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
