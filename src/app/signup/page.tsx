import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata: Metadata = {
  title: "Sign Up | Layah.ai",
  description: "Create a Layah account to start generating lesson plans, PPTs, worksheets, and assessments with AI.",
};

export default function SignupPage() {
  return (
    <AuthLayout
      badge="Teacher AI Suite"
      headline="Start creating teaching resources in minutes"
      subtext="Generate curriculum-aligned lesson plans, PPTs, worksheets and assessments using AI."
    >
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md rounded-3xl border bg-[#FAF6EF] p-8 text-sm text-stone-600">
            Loading…
          </div>
        }
      >
        <AuthCard defaultMode="signup" linkMode />
      </Suspense>
    </AuthLayout>
  );
}
