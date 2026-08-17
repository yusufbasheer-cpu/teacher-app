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
    <AuthLayout>
      <Suspense
        fallback={<div className="w-full max-w-[400px] text-center text-sm text-stone-600">Loading…</div>}
      >
        <AuthCard defaultMode="login" linkMode />
      </Suspense>
    </AuthLayout>
  );
}
