import type { Metadata } from "next";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { ProfileOnboardingForm } from "@/components/onboarding/profile-onboarding-form";

export const metadata: Metadata = {
  title: "Finish Setup | Layah.ai",
  description: "Complete your teacher profile to finish account setup.",
};

export default function OnboardingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <HeroBackdrop />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <section className="rounded-2xl border border-line bg-surface/80 p-6 shadow-sm backdrop-blur">
            <img src="/logo-mark.png" alt="" aria-hidden className="size-11 rounded-xl object-cover" />
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--brand)" }}>
              One-time setup
            </p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold tracking-[-0.04em] text-ink">
              Tell us a little about the teacher behind the account.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              We will use this to greet you by name, show your contact number where needed, and tailor
              the lesson experience to the subjects and grades you teach.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-muted">
              <div className="rounded-xl border border-line-subtle bg-sunken px-4 py-3">
                Full name, mobile number, subjects, designation, grades, and any extra context.
              </div>
              <div className="rounded-xl border border-line-subtle bg-sunken px-4 py-3">
                You only need to do this once after your first sign-in.
              </div>
              <div className="rounded-xl border border-line-subtle bg-sunken px-4 py-3">
                Once saved, we will drop you into the dashboard automatically.
              </div>
            </div>
          </section>

          <ProfileOnboardingForm />
        </div>
      </div>
    </div>
  );
}
