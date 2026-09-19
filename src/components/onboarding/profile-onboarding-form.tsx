"use client";

import { type ReactNode, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSafeAuthNext } from "@/lib/auth-redirect";
import { supabase } from "@/lib/supabase";
import { getTeacherProfile, hasCompletedTeacherProfile } from "@/lib/user-profile";
import { useErrorToast } from "@/hooks/use-error-toast";

const inputClass = [
  "w-full min-h-11 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink",
  "outline-none transition-[border-color,box-shadow] duration-[var(--t-fast)]",
  "placeholder:text-disabled hover:border-line-strong",
  "focus:border-brand focus:ring-2 focus:ring-brand/25",
].join(" ");

const textareaClass = `${inputClass} min-h-[104px] resize-y`;

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium" style={{ color: "var(--text)" }}>
      {children}
    </label>
  );
}

export function ProfileOnboardingForm() {
  const router = useRouter();
  const didInit = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useErrorToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [subjects, setSubjects] = useState("");
  const [designation, setDesignation] = useState("");
  const [grades, setGrades] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [aboutYou, setAboutYou] = useState("");

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      if (hasCompletedTeacherProfile(session.user)) {
        router.replace(getSafeAuthNext(new URLSearchParams(window.location.search).get("next")));
        return;
      }

      const profile = getTeacherProfile(session.user);
      setFullName(profile.full_name?.trim() ?? "");
      setPhone(profile.phone?.trim() ?? "");
      setSubjects(profile.subjects?.trim() ?? "");
      setDesignation(profile.designation?.trim() ?? "");
      setGrades(profile.grades_teach?.trim() ?? "");
      setSchoolName(profile.school_name?.trim() ?? "");
      setCity(profile.city?.trim() ?? "");
      setExperienceYears(profile.experience_years?.trim() ?? "");
      setAboutYou(profile.about_you?.trim() ?? "");
      setLoading(false);
    };

    void init();
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          subjects: subjects.trim(),
          designation: designation.trim(),
          grades_teach: grades.trim(),
          school_name: schoolName.trim(),
          city: city.trim(),
          experience_years: experienceYears.trim(),
          about_you: aboutYou.trim(),
          profile_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        },
      });

      if (updateError) throw updateError;

      router.replace(getSafeAuthNext(new URLSearchParams(window.location.search).get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface/95 p-6 shadow-sm backdrop-blur">
        <div className="h-5 w-40 animate-pulse rounded bg-hover" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-hover" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-hover/70" />
          <div className="h-24 animate-pulse rounded-lg bg-hover/70" />
          <div className="h-24 animate-pulse rounded-lg bg-hover/70" />
          <div className="h-24 animate-pulse rounded-lg bg-hover/70" />
        </div>
      </div>
    );
  }

  const sections = [
    {
      title: "Your details",
      description: "How we should address you in your workspace.",
      fields: [
        { id: "full-name", label: "Full name", value: fullName, set: setFullName, placeholder: "e.g. Priya Sharma", required: true, autoComplete: "name" },
        { id: "phone", label: "Mobile number", value: phone, set: setPhone, placeholder: "+91 98765 43210", autoComplete: "tel", type: "tel" },
        { id: "designation", label: "Designation", value: designation, set: setDesignation, placeholder: "Teacher, HOD, Principal" },
      ],
    },
    {
      title: "Your classroom",
      description: "A little context for the resources you prepare.",
      fields: [
        { id: "subjects", label: "Subjects you teach", value: subjects, set: setSubjects, placeholder: "Science, Biology, Physics" },
        { id: "grades", label: "Grades you teach", value: grades, set: setGrades, placeholder: "Grade 6, Grade 7, Grade 8" },
        { id: "school-name", label: "School name", value: schoolName, set: setSchoolName, placeholder: "Your school or institution" },
        { id: "city", label: "City or region", value: city, set: setCity, placeholder: "Mumbai", autoComplete: "address-level2" },
        { id: "experience-years", label: "Teaching experience", value: experienceYears, set: setExperienceYears, placeholder: "e.g. 8 years" },
      ],
    },
  ];

  return (
    <form onSubmit={onSubmit} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-busy={saving}>
      <div className="divide-y divide-line">
        {sections.map((section) => (
          <fieldset key={section.title} className="grid gap-6 p-6 sm:p-8 md:grid-cols-[200px_1fr]">
            <legend className="sr-only">{section.title}</legend>
            <div>
              <h2 className="section-heading">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{section.description}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.id} className={`flex flex-col gap-2 ${field.id === "full-name" ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={field.id}>{field.label}{"required" in field && field.required ? " *" : ""}</Label>
                  <input
                    id={field.id}
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    placeholder={field.placeholder}
                    className={inputClass}
                    type={"type" in field ? field.type : "text"}
                    autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                    required={"required" in field && field.required}
                    disabled={saving}
                  />
                </div>
              ))}
              {section.title === "Your classroom" && (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="about-you">Additional context</Label>
                  <textarea id="about-you" value={aboutYou} onChange={(event) => setAboutYou(event.target.value)} placeholder="Your preferred curriculum, teaching style, or language." className={textareaClass} disabled={saving} />
                  <p className="text-sm text-faint">Optional. Add anything that helps describe your teaching.</p>
                </div>
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="border-t border-line bg-sunken px-6 py-5 sm:px-8">
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-sm text-muted">Your workspace is ready after this step.</p>
          <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-on transition-colors duration-[var(--t-fast)] hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {saving ? "Saving profile..." : "Save and continue"}
          </button>
        </div>
      </div>
    </form>
  );
}
