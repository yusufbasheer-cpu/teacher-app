"use client";

import { type ReactNode, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getTeacherProfile, hasCompletedTeacherProfile } from "@/lib/user-profile";
import { useErrorToast } from "@/hooks/use-error-toast";

const inputClass = [
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] text-ink",
  "outline-none transition-[border-color,box-shadow] duration-[110ms]",
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
        router.replace("/overview");
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

      router.replace("/overview");
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

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-surface/95 p-6 shadow-sm backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--brand)" }}>
            Teacher setup
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">
            Finish your profile
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            We use these details to personalize your lesson plans, address you correctly in the app,
            and keep your account profile ready for school and teacher workflows.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="full-name">Full name</Label>
          <input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            className={inputClass}
            autoComplete="name"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Mobile number</Label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={inputClass}
            autoComplete="tel"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="designation">Designation</Label>
          <input
            id="designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Teacher, HOD, Principal..."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="subjects">Subjects you teach</Label>
          <textarea
            id="subjects"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="Science, Biology, Physics"
            className={textareaClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="grades">Grades you teach</Label>
          <textarea
            id="grades"
            value={grades}
            onChange={(e) => setGrades(e.target.value)}
            placeholder="Grade 6, Grade 7, Grade 8"
            className={textareaClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="school-name">School name</Label>
          <input
            id="school-name"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Your school or institution"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City / region</Label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Mumbai, Delhi, etc."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="experience-years">Teaching experience</Label>
          <input
            id="experience-years"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="e.g. 8 years"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="about-you">Anything else we should know?</Label>
          <textarea
            id="about-you"
            value={aboutYou}
            onChange={(e) => setAboutYou(e.target.value)}
            placeholder="Preferred board, teaching style, language, or any extra context."
            className={textareaClass}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          This only happens once. After you save it, we will take you straight into the app.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-brand-on transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Continue to dashboard"}
        </button>
      </div>
    </form>
  );
}
