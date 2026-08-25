import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PageLoader } from "@/components/ui/animate";

export const metadata: Metadata = {
  title: "Sign Up | Layah.ai",
  description: "Create a Layah account to start generating lesson plans, PPTs, worksheets, and assessments with AI.",
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
