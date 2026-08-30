"use client";

import { useEffect, useState } from "react";
import { useErrorToast } from "@/hooks/use-error-toast";
import { supabase } from "@/lib/supabase";
import { usePricingRegion } from "@/hooks/use-pricing-region";
import {
  formatRegionalPrice,
  PRICING_REGION_LIST,
  type PaidPlanKey,
  type PricingRegion,
  type PricingRegionId,
} from "@/lib/pricing-regions";

const NAVY = "var(--text)";
const TEAL = "var(--brand)";
const MUTED = "var(--text-secondary)";

type Step = 1 | 2 | 3 | 4 | "done";

type SchoolForm = {
  schoolName: string;
  emailDomain: string;
  country: string;
  numTeachers: string;
  phone: string;
  howHeard: string;
};

type SelectedPlan = {
  id: string;
  name: string;
  priceLabel: string;
};

const COUNTRY_LIST = [
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Bahrain",
  "Kuwait",
  "Oman",
  "India",
  "Pakistan",
  "Bangladesh",
  "Sri Lanka",
  "Nepal",
  "Philippines",
  "Indonesia",
  "Malaysia",
  "Singapore",
  "Myanmar",
  "Nigeria",
  "Kenya",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Other",
] as const;

const NUM_TEACHER_OPTIONS = ["Up to 10", "Up to 30", "Unlimited"] as const;
const HOW_HEARD_OPTIONS = ["Google", "Social Media", "Colleague", "Other"] as const;

type SchoolPlanDef = {
  id: string;
  name: string;
  priceKey: PaidPlanKey;
  teachers: string;
  features: string[];
  highlight?: boolean;
};

const SCHOOL_PLANS: SchoolPlanDef[] = [
  {
    id: "school_starter",
    name: "School Starter",
    priceKey: "schoolStarter",
    teachers: "Up to 10 teachers",
    features: [
      "Unlimited generations for all teachers",
      "HOD Dashboard",
      "Department Groups",
      "School Branding on PPTs",
      "Usage Analytics",
      "Priority Support",
    ],
  },
  {
    id: "school_pro",
    name: "School Pro",
    priceKey: "schoolPro",
    teachers: "Up to 30 teachers",
    highlight: true,
    features: [
      "Everything in School Starter",
      "Lesson Plan Approval System",
      "Advanced Analytics",
      "Dedicated Account Manager",
    ],
  },
  {
    id: "school_enterprise",
    name: "School Enterprise",
    priceKey: "schoolEnterprise",
    teachers: "Unlimited teachers",
    features: [
      "Everything in School Pro",
      "Custom School Branding",
      "API Access",
      "Custom Feature Requests",
      "SLA Support",
    ],
  },
];

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`size-5 shrink-0 ${className}`} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 10l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { num: 1, label: "Sign In" },
    { num: 2, label: "School Details" },
    { num: 3, label: "Choose Plan" },
    { num: 4, label: "Confirm" },
  ];
  const currentNum = typeof current === "number" ? current : 5;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const done = currentNum > s.num;
        const active = currentNum === s.num;
        return (
          <div key={s.num} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{
                  background: done ? TEAL : active ? NAVY : "var(--border)",
                  color: done || active ? "#fff" : "var(--text-disabled)",
                }}
              >
                {done ? (
                  <CheckIcon className="text-white" />
                ) : (
                  s.num
                )}
              </div>
              <span
                className="hidden text-xs font-semibold sm:inline"
                style={{ color: active ? NAVY : done ? TEAL : "var(--text-disabled)" }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-0.5 w-6 sm:w-10"
                style={{ background: done ? TEAL : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  region,
  onSelect,
}: {
  plan: SchoolPlanDef;
  region: PricingRegion;
  onSelect: (plan: SchoolPlanDef, priceLabel: string) => void;
}) {
  const prices = region.prices[plan.priceKey];
  const monthlyLabel = formatRegionalPrice(region, prices.monthly, "month");
  const annualLabel = formatRegionalPrice(region, prices.annual, "year");

  return (
    <article
      className="relative flex flex-col rounded-2xl border p-6 shadow-sm transition hover:shadow-md"
      style={{
        borderColor: plan.highlight ? TEAL : "color-mix(in oklch, var(--text) 12%, transparent)",
        borderWidth: plan.highlight ? 2 : 1,
        background: "var(--surface-raised)",
      }}
    >
      {plan.highlight && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ background: TEAL, color: NAVY }}
        >
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-bold" style={{ color: NAVY }}>
        {plan.name}
      </h3>
      <p className="mt-2 text-2xl font-extrabold" style={{ color: NAVY }}>
        {monthlyLabel}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Or {annualLabel}
      </p>
      <p className="mt-3 text-sm font-semibold" style={{ color: TEAL }}>
        {plan.teachers}
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
            <CheckIcon className="text-[var(--brand-active)]" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onSelect(plan, monthlyLabel)}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: plan.highlight ? TEAL : NAVY }}
      >
        Select {plan.name}
      </button>
    </article>
  );
}

export function SchoolRegisterForm() {
  const [step, setStep] = useState<Step>(1);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [form, setForm] = useState<SchoolForm>({
    schoolName: "",
    emailDomain: "",
    country: "",
    numTeachers: "",
    phone: "",
    howHeard: "",
  });
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useErrorToast();

  const { region, regionId, setRegionManually, loading: regionLoading } = usePricingRegion();

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.email) {
      const email = session.user.email;
      const domain = email.split("@")[1] ?? "";
      setUserEmail(email);
      setUserId(session.user.id);
      setForm((prev) => ({ ...prev, emailDomain: domain }));
      setStep(2);
      setGoogleLoading(false);
      return;
    }

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/school-register?step=2",
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  const handleCheckSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.email) {
      const email = session.user.email;
      const domain = email.split("@")[1] ?? "";
      setUserEmail(email);
      setUserId(session.user.id);
      setForm((prev) => ({ ...prev, emailDomain: domain }));
      setStep(2);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("step") === "2") {
        void handleCheckSession();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = () => {
    if (!form.schoolName.trim()) {
      setError("Please enter your school name.");
      return;
    }
    if (!form.country) {
      setError("Please select your country.");
      return;
    }
    if (!form.numTeachers) {
      setError("Please select the number of teachers.");
      return;
    }
    setError(null);
    setStep(3);
  };

  const handlePlanSelect = (plan: SchoolPlanDef, priceLabel: string) => {
    setSelectedPlan({ id: plan.id, name: plan.name, priceLabel });
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/school-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: userEmail,
          adminUserId: userId || undefined,
          schoolName: form.schoolName,
          emailDomain: form.emailDomain,
          country: form.country,
          numTeachers: form.numTeachers,
          phone: form.phone,
          howHeard: form.howHeard,
          planSelected: selectedPlan.name,
          planPrice: selectedPlan.priceLabel,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Submission failed.");
      }

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    "w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[color-mix(in_oklch,var(--brand)_40%,transparent)]";
  const labelClasses = "mb-1.5 block text-sm font-semibold";

  return (
    <div className="mx-auto w-full max-w-4xl">
      {step !== "done" && (
        <div className="mb-10">
          <StepIndicator current={step} />
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="mx-auto max-w-md">
          <div
            className="rounded-3xl border bg-[var(--surface)] p-8 shadow-sm"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <div className="text-center">
              <div
                className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl"
                style={{ background: "color-mix(in oklch, var(--brand) 10%, transparent)" }}
              >
                <svg
                  className="size-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={TEAL}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                  <line x1="12" y1="6" x2="12" y2="14" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                </svg>
              </div>
              <h2 className="text-xl font-bold" style={{ color: NAVY }}>
                Register Your School
              </h2>
              <p className="mt-2 text-sm" style={{ color: MUTED }}>
                Please sign in with your official school Google account to continue
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleLoading}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border bg-[var(--surface)] px-4 py-3 text-sm font-semibold transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderColor: "#dadce0", color: NAVY }}
            >
              {googleLoading ? (
                <div className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-slate-600" />
              ) : (
                <GoogleLogo />
              )}
              <span>{googleLoading ? "Connecting..." : "Continue with Google"}</span>
            </button>

            <p className="mt-4 text-center text-xs" style={{ color: "var(--text-disabled)" }}>
              We will extract your school email domain automatically
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mx-auto max-w-lg">
          <div
            className="rounded-3xl border bg-[var(--surface)] p-6 shadow-sm sm:p-8"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>
              School Details
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Signed in as <strong style={{ color: TEAL }}>{userEmail}</strong>
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  School Name *
                </label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
                  placeholder="e.g. Greenfield International School"
                  className={inputClasses}
                  style={{ borderColor: "#D9CCB8", color: NAVY }}
                />
              </div>

              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  School Email Domain
                </label>
                <div
                  className="flex items-center rounded-xl border bg-hover px-4 py-2.5 text-sm"
                  style={{ borderColor: "#D9CCB8", color: NAVY }}
                >
                  <span style={{ color: "var(--text-disabled)" }}>@</span>
                  <span className="ml-1 font-medium">{form.emailDomain || "—"}</span>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-disabled)" }}>
                  Auto-detected from your Google account
                </p>
              </div>

              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  Country *
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className={inputClasses}
                  style={{ borderColor: "#D9CCB8", color: form.country ? NAVY : "var(--text-disabled)" }}
                >
                  <option value="">Select your country</option>
                  {COUNTRY_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  Number of Teachers *
                </label>
                <select
                  value={form.numTeachers}
                  onChange={(e) => setForm((f) => ({ ...f, numTeachers: e.target.value }))}
                  className={inputClasses}
                  style={{ borderColor: "#D9CCB8", color: form.numTeachers ? NAVY : "var(--text-disabled)" }}
                >
                  <option value="">Select number of teachers</option>
                  {NUM_TEACHER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+971 50 123 4567"
                  className={inputClasses}
                  style={{ borderColor: "#D9CCB8", color: NAVY }}
                />
              </div>

              <div>
                <label className={labelClasses} style={{ color: NAVY }}>
                  How did you hear about us?
                </label>
                <select
                  value={form.howHeard}
                  onChange={(e) => setForm((f) => ({ ...f, howHeard: e.target.value }))}
                  className={inputClasses}
                  style={{ borderColor: "#D9CCB8", color: form.howHeard ? NAVY : "var(--text-disabled)" }}
                >
                  <option value="">Select an option</option>
                  {HOW_HEARD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-hover"
                style={{ borderColor: "#D9CCB8", color: MUTED }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: TEAL }}
              >
                Continue to Plans
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>
              Choose Your School Plan
            </h2>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              All plans include unlimited generations for every teacher
            </p>
          </div>

          {!regionLoading && (
            <div className="mx-auto mb-8 flex max-w-xs flex-col items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Pricing currency
              </label>
              <select
                value={regionId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setRegionManually(v as PricingRegionId);
                }}
                className="w-full rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-sm font-medium outline-none transition"
                style={{ borderColor: "color-mix(in oklch, var(--text) 15%, transparent)", color: NAVY }}
              >
                {PRICING_REGION_LIST.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.flag} {r.selectorLabel}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {SCHOOL_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                region={region}
                onSelect={handlePlanSelect}
              />
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm font-semibold transition hover:opacity-80"
              style={{ color: MUTED }}
            >
              Back to School Details
            </button>
          </div>
        </div>
      )}

      {step === 4 && selectedPlan && (
        <div className="mx-auto max-w-lg">
          <div
            className="rounded-3xl border bg-[var(--surface)] p-6 shadow-sm sm:p-8"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>
              Confirm Your Registration
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Review your school details before submitting
            </p>

            <div
              className="mt-6 rounded-2xl p-5"
              style={{ background: "color-mix(in oklch, var(--brand) 6%, transparent)", border: "1px solid color-mix(in oklch, var(--brand) 20%, transparent)" }}
            >
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>School Name</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>
                    {form.schoolName}
                  </dd>
                </div>
                <div
                  className="border-t"
                  style={{ borderColor: "color-mix(in oklch, var(--brand) 15%, transparent)" }}
                />
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>Plan Selected</dt>
                  <dd className="font-semibold" style={{ color: TEAL }}>
                    {selectedPlan.name}
                  </dd>
                </div>
                <div
                  className="border-t"
                  style={{ borderColor: "color-mix(in oklch, var(--brand) 15%, transparent)" }}
                />
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>Price</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>
                    {selectedPlan.priceLabel}
                  </dd>
                </div>
                <div
                  className="border-t"
                  style={{ borderColor: "color-mix(in oklch, var(--brand) 15%, transparent)" }}
                />
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>Number of Teachers</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>
                    {form.numTeachers}
                  </dd>
                </div>
                <div
                  className="border-t"
                  style={{ borderColor: "color-mix(in oklch, var(--brand) 15%, transparent)" }}
                />
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>Admin Email</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>
                    {userEmail}
                  </dd>
                </div>
                <div
                  className="border-t"
                  style={{ borderColor: "color-mix(in oklch, var(--brand) 15%, transparent)" }}
                />
                <div className="flex justify-between">
                  <dt style={{ color: MUTED }}>Email Domain</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>
                    @{form.emailDomain}
                  </dd>
                </div>
              </dl>
            </div>

            <div
              className="mt-6 rounded-xl p-4 text-sm"
              style={{ background: "color-mix(in oklch, var(--text) 4%, transparent)", color: MUTED }}
            >
              Your school account is being set up. Our team will contact you within 24 hours to
              complete payment and activation.
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-hover"
                style={{ borderColor: "#D9CCB8", color: MUTED }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleFinalSubmit()}
                disabled={submitting}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: TEAL }}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mx-auto max-w-md text-center">
          <div
            className="rounded-3xl border bg-[var(--surface)] p-8 shadow-sm sm:p-10"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 20%, transparent)" }}
          >
            <div
              className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full"
              style={{ background: "color-mix(in oklch, var(--brand) 12%, transparent)" }}
            >
              <CheckIcon className="!size-10 text-[var(--brand)]" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
              Thank You!
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
              Your school registration request has been submitted successfully. Our team will review
              your details and contact you at{" "}
              <strong style={{ color: NAVY }}>{userEmail}</strong> within 24 hours to complete
              payment and activate your school account.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <a
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: TEAL }}
              >
                Go to Dashboard
              </a>
              <a
                href="/pricing"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:bg-hover"
                style={{ borderColor: "#D9CCB8", color: MUTED }}
              >
                View Pricing
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
