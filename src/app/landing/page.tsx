import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { StatsSection } from "@/components/home/stats-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { FeedbackSection } from "@/components/home/feedback-section";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Layah.ai — AI Lesson Planning for Teachers",
  description:
    "Layah generates complete lesson plans, PowerPoint presentations, worksheets, and assessments in seconds. Built specifically for teachers.",
};

const TEAL = "#00C6A7";
const NAVY = "#0A1628";

// ─── Wavy SVG Divider ─────────────────────────────────────────────────────────
function WavyDivider({ flip = false, fill = "#F0FDFB" }: { flip?: boolean; fill?: string }) {
  return (
    <div className="overflow-hidden leading-none" style={{ transform: flip ? "scaleY(-1)" : undefined }}>
      <svg viewBox="0 0 1440 72" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full h-12 sm:h-16 md:h-20">
        <path d="M0,36 C240,72 480,0 720,36 C960,72 1200,0 1440,36 L1440,72 L0,72 Z" fill={fill} />
      </svg>
    </div>
  );
}

// ─── Sparkle decoration ────────────────────────────────────────────────────────
function Sparkle({ className, color = "#FCD34D", size = 20 }: { className: string; color?: string; size?: number }) {
  return (
    <svg
      className={`absolute pointer-events-none ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden
    >
      <path d="M12 2l1.8 5.5H19l-4.6 3.4 1.7 5.4L12 13l-4.1 3.3 1.7-5.4L5 7.5h5.2z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFFFFF", color: NAVY }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden pb-16 pt-16 md:pb-24 md:pt-24"
        style={{ background: "linear-gradient(160deg, #F0FDFB 0%, #FFFFFF 60%)" }}
      >
        {/* Floating blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full blur-3xl" style={{ background: "rgba(0,198,167,0.12)" }} />
          <div className="absolute top-24 -right-16 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(251,191,36,0.10)" }} />
          <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(139,92,246,0.08)" }} />
        </div>

        {/* Sparkles */}
        <Sparkle className="top-16 left-[8%] opacity-70" color="#FCD34D" size={18} />
        <Sparkle className="top-32 right-[12%] opacity-60" color="#00C6A7" size={14} />
        <Sparkle className="bottom-24 left-[20%] opacity-50" color="#A78BFA" size={12} />
        <Sparkle className="top-20 left-[45%] opacity-40" color="#FCD34D" size={10} />
        <Sparkle className="top-48 right-[30%] opacity-50" color="#F472B6" size={16} />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">

            {/* ── LEFT: hero text ──────────────────────────────────────── */}
            <div className="flex-1 text-center lg:text-left">
              {/* Caveat accent */}
              <p className="font-caveat mb-3 text-xl font-semibold" style={{ color: TEAL }}>
                ✨ designed for teachers, by a teacher
              </p>

              {/* Badge */}
              <span
                className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ borderColor: TEAL, color: TEAL, background: "rgba(0,198,167,0.08)" }}
              >
                <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: TEAL }} />
                AI-powered lesson planning
              </span>

              <h1
                className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-5xl xl:text-6xl"
                style={{ color: NAVY }}
              >
                Plan better lessons{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #00C6A7 0%, #0A8F7A 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  in minutes
                </span>{" "}
                🎓
              </h1>

              <p
                className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl lg:mx-0"
                style={{ color: "#374151" }}
              >
                Layah generates complete lesson plans, beautiful PowerPoint presentations, worksheets,
                and assessments — so you can focus on what matters: your students.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/lesson-plan"
                  className="btn-pulse inline-flex min-h-14 items-center justify-center rounded-2xl px-10 py-4 text-lg font-bold text-white shadow-xl transition hover:opacity-90 hover:shadow-2xl"
                  style={{ background: TEAL }}
                >
                  Start for Free — No Credit Card 🚀
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border px-8 py-4 text-base font-semibold transition hover:bg-gray-50"
                  style={{ borderColor: "#E5E7EB", color: NAVY }}
                >
                  See how it works →
                </a>
              </div>

              <p className="mt-6 font-caveat text-base" style={{ color: "#4A5568" }}>
                Trusted by teachers across UAE · CBSE · British · American curricula 🌍
              </p>
            </div>

            {/* ── RIGHT: premium preview card ──────────────────────────── */}
            <div className="w-full flex-shrink-0 lg:w-[460px]">
              <HeroPreviewCard />
            </div>

          </div>
        </div>
      </section>

      {/* ── WAVY DIVIDER ───────────────────────────────────────────────────── */}
      <WavyDivider fill="#F0FDFB" />

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28" style={{ background: "#F0FDFB" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p className="font-caveat mb-2 text-xl font-semibold" style={{ color: TEAL }}>What Layah does for you</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: NAVY }}>
              Everything teachers need 🧑‍🏫
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: "#374151" }}>
              Stop spending your evenings planning. Layah handles the hard work so you can focus on teaching.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              emoji="📝"
              title="Complete Lesson Plans"
              description="Generate fully structured lesson plans aligned with UAE, CBSE, British and American curricula in seconds. Objectives, activities, timings — all included."
              bg="#E6F7F5"
              iconColor="#00C6A7"
            />
            <FeatureCard
              emoji="🖥️"
              title="Professional PPT Slides"
              description="Beautiful PowerPoint presentations with proper lesson structure, AFL tools, and differentiated activities — ready to download and present."
              bg="#FFF3E0"
              iconColor="#F59E0B"
            />
            <FeatureCard
              emoji="📋"
              title="Full Resource Pack"
              description="Worksheets, assessments, homework, teacher notes and AFL tools — all generated together in one complete downloadable package."
              bg="#F3E8FF"
              iconColor="#8B5CF6"
            />
            <FeatureCard
              emoji="🎯"
              title="Curriculum Alignment"
              description="Plans aligned to grade outcomes and learning standards. Choose from 15+ curricula across the globe."
              bg="#FFF0F5"
              iconColor="#EC4899"
            />
            <FeatureCard
              emoji="✅"
              title="87 AFL Tools"
              description="Built-in Assessment for Learning tools to make your lessons more engaging and evidence-based."
              bg="#F0F4FF"
              iconColor="#6366F1"
            />
            <FeatureCard
              emoji="⬇️"
              title="One-Click Export"
              description="Download everything as Word, PowerPoint, or ZIP in one click. No formatting, no copy-paste. Just great resources."
              bg="#F0FDFB"
              iconColor="#00C6A7"
            />
          </div>
        </div>
      </section>

      {/* ── WAVY DIVIDER ───────────────────────────────────────────────────── */}
      <WavyDivider fill="#FFFFFF" flip />

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <StatsSection />

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <WavyDivider fill="#F0FDFB" />
      <section id="how-it-works" className="py-20 md:py-28" style={{ background: "#F0FDFB" }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <p className="font-caveat mb-2 text-xl font-semibold" style={{ color: TEAL }}>Simple process</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: NAVY }}>
              Ready in under 2 minutes ⚡
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: "#374151" }}>
              From blank page to complete lesson pack — faster than making a cup of tea.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard number="01" emoji="✏️" title="Enter your subject, grade and topic" description="Tell Layah what you're teaching. Subject, grade level, curriculum, and the lesson topic." color="#E6F7F5" accent={TEAL} />
            <StepCard number="02" emoji="🎯" title="Select curriculum and AFL tools" description="Choose from UAE, CBSE, British or American curriculum. Pick AFL tools or let Layah auto-select the best ones." color="#FFF3E0" accent="#F59E0B" />
            <StepCard number="03" emoji="🎉" title="Download your complete lesson pack" description="Get your lesson plan, PowerPoint, worksheets, assessments, and AFL tools — all ready to use." color="#F3E8FF" accent="#8B5CF6" />
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/lesson-plan"
              className="btn-pulse inline-flex min-h-14 items-center justify-center rounded-2xl px-12 py-4 text-lg font-bold text-white shadow-xl transition hover:opacity-90"
              style={{ background: TEAL }}
            >
              Try It Now — It&apos;s Free 🚀
            </Link>
            <p className="font-caveat mt-4 text-base" style={{ color: "#4A5568" }}>No credit card needed · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FEEDBACK ───────────────────────────────────────────────────────── */}
      <FeedbackSection />

      {/* ── CTA BANNER ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20"
        style={{ background: "linear-gradient(135deg, #00C6A7 0%, #0A8F7A 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 -left-10 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="absolute -bottom-10 right-0 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="font-caveat mb-3 text-xl font-semibold text-white/80">join thousands of happy teachers 💚</p>
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Start planning better lessons today
          </h2>
          <p className="mt-4 text-base text-white/80">
            Save hours every week. Impress in inspections. Delight your students.
          </p>
          <Link
            href="/lesson-plan"
            className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-12 py-4 text-lg font-bold shadow-xl transition hover:bg-slate-50"
            style={{ color: "#0A8F7A" }}
          >
            Get Started Free — No Credit Card Required
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const HERO_CHECKLIST = [
  "Learning Objectives — UAE MOE Aligned",
  "Differentiated for Higher, Middle & Lower Achievers",
  "KHDA & SPEA Inspection-Ready Format",
  "Project-Based Learning Strategy Applied",
  "87 AFL Tools Integrated",
  "13-Slide Professional PowerPoint",
  "Differentiated Worksheet Pack",
  "Question Paper with Mark Scheme",
] as const;

const HERO_AVATARS = [
  { initial: "A", bg: "#F59E0B" },
  { initial: "T", bg: "#00C6A7" },
  { initial: "S", bg: "#8B5CF6" },
  { initial: "M", bg: "#3B82F6" },
  { initial: "R", bg: "#EC4899" },
] as const;

function TealCheck() {
  return (
    <svg
      className="mt-0.5 h-[18px] w-[18px] shrink-0"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
    >
      <circle cx="9" cy="9" r="9" fill="rgba(0,198,167,0.12)" />
      <path
        d="M5.5 9l2.5 2.5 4.5-5"
        stroke="#00C6A7"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroPreviewCard() {
  return (
    <div
      className="relative mx-auto w-full max-w-md lg:mx-0"
      style={{ transform: "rotate(1deg)" }}
    >
      {/* Soft glow behind the card */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-3xl blur-2xl"
        style={{ background: "rgba(0,198,167,0.10)" }}
      />

      <div
        className="relative overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ border: "1px solid rgba(0,198,167,0.22)" }}
      >
        {/* Teal top accent bar */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #00C6A7 0%, #0A8F7A 100%)" }}
        />

        {/* Card header */}
        <div
          className="px-5 pb-4 pt-5"
          style={{ borderBottom: "1px solid #F3F4F6" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold" style={{ color: "#6B7280" }}>
                📚 Science · Grade 7
              </p>
              <p
                className="mt-1 text-xl font-bold leading-tight"
                style={{
                  color: NAVY,
                  fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
                }}
              >
                Photosynthesis
              </p>
              <p className="mt-1 text-xs" style={{ color: "#6B7280" }}>
                Generated in 45 seconds ⚡
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "rgba(0,198,167,0.12)", color: TEAL }}
            >
              UAE MOE
            </span>
          </div>
        </div>

        {/* Checklist — items fade in one by one via CSS stagger */}
        <ul className="space-y-2.5 px-5 py-4">
          {HERO_CHECKLIST.map((item, i) => (
            <li
              key={item}
              className={`animate-fade-in stagger-${i + 1} flex items-start gap-3`}
            >
              <TealCheck />
              <span
                className="text-sm leading-snug"
                style={{ color: "#374151" }}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* Card footer */}
        <div
          className="px-5 pb-5 pt-3"
          style={{ borderTop: "1px solid #F3F4F6" }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {HERO_AVATARS.map((a) => (
                <div
                  key={a.initial}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white"
                  style={{ background: a.bg }}
                  aria-label={`User ${a.initial}`}
                >
                  {a.initial}
                </div>
              ))}
            </div>
            <p className="text-xs leading-snug" style={{ color: "#6B7280" }}>
              Join{" "}
              <strong style={{ color: NAVY }}>500+ teachers</strong>{" "}
              saving hours every week
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  emoji, title, description, bg, iconColor,
}: {
  emoji: string; title: string; description: string; bg: string; iconColor: string;
}) {
  return (
    <div
      className="group rounded-3xl p-7 shadow-sm transition hover:shadow-lg hover:-translate-y-1"
      style={{ background: bg, border: "1px solid rgba(0,0,0,0.04)" }}
    >
      <div
        className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-sm"
        style={{ background: "#FFFFFF" }}
      >
        {emoji}
      </div>
      <h3 className="text-lg font-bold" style={{ color: "#0A1628" }}>{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "#374151" }}>{description}</p>
    </div>
  );
}

function StepCard({
  number, emoji, title, description, color, accent,
}: {
  number: string; emoji: string; title: string; description: string; color: string; accent: string;
}) {
  return (
    <div
      className="rounded-3xl p-8 shadow-sm transition hover:shadow-lg"
      style={{ background: color, border: "1px solid rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl font-extrabold" style={{ color: accent, opacity: 0.4 }}>{number}</span>
        <span className="text-3xl">{emoji}</span>
      </div>
      <div className="mb-4 h-1 w-10 rounded-full" style={{ background: accent }} />
      <h3 className="text-lg font-bold" style={{ color: "#0A1628" }}>{title}</h3>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "#374151" }}>{description}</p>
    </div>
  );
}
