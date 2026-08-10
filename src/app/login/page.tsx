import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata: Metadata = {
  title: "Login | Layah.ai",
  description: "Login to your Layah account to access your lesson plans, PPTs, worksheets, and assessments.",
};

export default function LoginPage() {
  return (
    <AuthLayout
      badge="Teacher AI Suite"
      headline="Welcome back"
      subtext="Continue creating lesson plans, presentations, worksheets and assessments with AI."
    >
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md rounded-3xl border bg-[#FAF6EF] p-8 text-sm text-stone-600">
            Loading…
          </div>
        }
      >
        <AuthCard defaultMode="login" linkMode />
      </Suspense>
    </AuthLayout>
  );
}
