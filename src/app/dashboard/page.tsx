"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy Google redirect — send to the auth callback route. */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/auth/callback${search}`);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
      <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
        Signing you in…
      </p>
    </main>
  );
}
