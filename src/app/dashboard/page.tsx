"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerActiveSession } from "@/lib/active-session";
import { supabase } from "@/lib/supabase";

/** OAuth redirect target — registers session then sends teachers to the app. */
export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    const finish = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus("Redirecting to login…");
        router.replace("/auth");
        return;
      }

      try {
        await registerActiveSession(session.user.id);
      } catch {
        /* session row optional; continue into app */
      }

      router.replace("/lesson-plan");
      router.refresh();
    };

    void finish();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
      <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
        {status}
      </p>
    </main>
  );
}
