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
import { Badge, Notice, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { StepWizardProgress } from "@/components/ui/step-wizard-progress";

type Step = 1 | 2 | 3 | 4 | "done";

const WIZARD_STEPS = [
  { id: 1, label: "Sign In" },
  { id: 2, label: "School Details" },
  { id: 3, label: "Choose Plan" },
  { id: 4, label: "Confirm" },
] as const;

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
      className={`relative flex flex-col rounded-2xl border bg-surface-raised p-6 transition-colors duration-[110ms] ${
        plan.highlight ? "border-2 border-brand" : "border-line-subtle"
      }`}
    >
      {plan.highlight && (
        <Badge tone="brand" className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 uppercase tracking-wide">
          Most Popular
        </Badge>
      )}
      <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
      <p className="mt-2 text-2xl font-extrabold text-ink">{monthlyLabel}</p>
      <p className="mt-1 text-sm text-muted">Or {annualLabel}</p>
      <p className="mt-3 text-sm font-semibold text-brand-text">{plan.teachers}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink">
            <CheckIcon className="text-brand-active" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="lg"
        block
        interactive={plan.highlight}
        variant={plan.highlight ? "default" : "outline"}
        className="mt-6"
        onClick={() => onSelect(plan, monthlyLabel)}
      >
        Select {plan.name}
      </Button>
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
          // Ask Google to show the account chooser instead of reusing the last account.
          queryParams: {
            prompt: "select_account",
          },
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

  return (
    <div className="mx-auto w-full max-w-4xl">
      {step !== "done" && (
        <div className="mb-10">
          <StepWizardProgress steps={WIZARD_STEPS} currentStep={typeof step === "number" ? step : 5} />
        </div>
      )}

      {error && (
        <Notice tone="danger" className="mb-6">
          {error}
        </Notice>
      )}

      {step === 1 && (
        <div className="mx-auto max-w-md">
          <Panel className="p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-subtle">
                <svg
                  className="size-8 text-brand"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
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
              <h2 className="text-xl font-bold text-ink">Register Your School</h2>
              <p className="mt-2 text-sm text-muted">
                Please sign in with your official school Google account to continue
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="xl"
              block
              className="mt-8"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <div className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
              ) : (
                <GoogleLogo />
              )}
              <span>{googleLoading ? "Connecting..." : "Continue with Google"}</span>
            </Button>

            <p className="mt-4 text-center text-xs text-disabled">
              We will extract your school email domain automatically
            </p>
          </Panel>
        </div>
      )}

      {step === 2 && (
        <div className="mx-auto max-w-lg">
          <Panel className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-ink">School Details</h2>
            <p className="mt-1 text-sm text-muted">
              Signed in as <strong className="text-brand-text">{userEmail}</strong>
            </p>

            <div className="mt-6 space-y-4">
              <Field label="School Name">
                <TextInput
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
                  placeholder="e.g. Greenfield International School"
                />
              </Field>

              <Field label="School Email Domain" hint="Auto-detected from your Google account">
                <div className="flex items-center rounded-md border border-line bg-hover px-3 py-2 text-sm text-ink">
                  <span className="text-disabled">@</span>
                  <span className="ml-1 font-medium">{form.emailDomain || "—"}</span>
                </div>
              </Field>

              <Field label="Country">
                <Select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                >
                  <option value="">Select your country</option>
                  {COUNTRY_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Number of Teachers">
                <Select
                  value={form.numTeachers}
                  onChange={(e) => setForm((f) => ({ ...f, numTeachers: e.target.value }))}
                >
                  <option value="">Select number of teachers</option>
                  {NUM_TEACHER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Phone Number" optional>
                <TextInput
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+971 50 123 4567"
                />
              </Field>

              <Field label="How did you hear about us?" optional>
                <Select
                  value={form.howHeard}
                  onChange={(e) => setForm((f) => ({ ...f, howHeard: e.target.value }))}
                >
                  <option value="">Select an option</option>
                  {HOW_HEARD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-8 flex gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" size="lg" block onClick={handleFormSubmit}>
                Continue to Plans
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold text-ink">Choose Your School Plan</h2>
            <p className="mt-2 text-sm text-muted">All plans include unlimited generations for every teacher</p>
          </div>

          {!regionLoading && (
            <div className="mx-auto mb-8 max-w-xs">
              <Field label="Pricing currency" className="text-center">
                <Select
                  value={regionId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setRegionManually(v as PricingRegionId);
                  }}
                >
                  {PRICING_REGION_LIST.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.flag} {r.selectorLabel}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {SCHOOL_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} region={region} onSelect={handlePlanSelect} />
            ))}
          </div>

          <div className="mt-6 text-center">
            <Button type="button" variant="link" onClick={() => setStep(2)}>
              Back to School Details
            </Button>
          </div>
        </div>
      )}

      {step === 4 && selectedPlan && (
        <div className="mx-auto max-w-lg">
          <Panel className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-ink">Confirm Your Registration</h2>
            <p className="mt-1 text-sm text-muted">Review your school details before submitting</p>

            <div className="mt-6 rounded-2xl border border-brand-border/50 bg-brand-subtle p-5">
              <dl className="space-y-3 text-sm">
                {[
                  ["School Name", form.schoolName],
                  ["Plan Selected", selectedPlan.name],
                  ["Price", selectedPlan.priceLabel],
                  ["Number of Teachers", form.numTeachers],
                  ["Admin Email", userEmail],
                  ["Email Domain", `@${form.emailDomain}`],
                ].map(([label, value], i) => (
                  <div key={label}>
                    {i > 0 ? <div className="mb-3 border-t border-brand-border/40" /> : null}
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-semibold text-ink">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            <Notice className="mt-6">
              Your school account is being set up. Our team will contact you within 24 hours to
              complete payment and activation.
            </Notice>

            <div className="mt-8 flex gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button type="button" size="lg" block disabled={submitting} onClick={() => void handleFinalSubmit()}>
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {step === "done" && (
        <div className="mx-auto max-w-md text-center">
          <Panel className="p-8 sm:p-10">
            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-brand-subtle">
              <CheckIcon className="!size-10 text-brand" />
            </div>
            <h2 className="text-2xl font-bold text-ink">Thank You!</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your school registration request has been submitted successfully. Our team will review
              your details and contact you at <strong className="text-ink">{userEmail}</strong> within
              24 hours to complete payment and activate your school account.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Button size="lg" render={<a href="/dashboard" />}>
                Go to Dashboard
              </Button>
              <Button variant="outline" size="lg" render={<a href="/pricing" />}>
                View Pricing
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
