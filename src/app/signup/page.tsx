import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PageLoader } from "@/components/ui/animate";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create a free Layah account and start generating AI lesson plans, PPTs, worksheets, question papers and assessments for your classes in minutes.",
};

export default function SignupPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={<div className="w-full max-w-[400px]"><PageLoader label="Loading…" /></div>}
      >
        <AuthCard defaultMode="signup" linkMode />
      </Suspense>
    </AuthLayout>
  );
}
