"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { registerActiveSession } from "@/lib/active-session";
import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";
import { supabase } from "@/lib/supabase";

function DashboardContent() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

      console.log("[dashboard] loaded", window.location.href);

      const code = params?.get("code");
      if (code) {
        console.log("[dashboard] OAuth code detected — forwarding to /auth/callback");
        router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
        return;
      }

      const schoolCheck = params?.get("school_check") === "1";
      if (schoolCheck) {
        console.log("=== AUTH CALLBACK (browser) — after server route ===");

        const user = await supabase.auth.getUser();
        const email = user.data.user?.email;
        const domain = email?.split("@")[1];

        console.log("Checking school domain for:", domain);

        const { data: school, error } = await supabase
          .from("school_accounts")
          .select("*")
          .eq("email_domain", domain ?? "")
          .maybeSingle();

        if (error) {
          console.log("School lookup error (client):", error.message);
        }

        console.log("School found:", school);
        console.log("School matched (server):", params?.get("school_matched"));

        const welcome = params?.get("school_welcome");
        if (welcome) {
          try {
            sessionStorage.setItem(SCHOOL_WELCOME_SESSION_KEY, decodeURIComponent(welcome));
          } catch {
            /* ignore */
          }
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/auth");
        return;
      }

      try {
        await registerActiveSession(session.user.id);
      } catch {
        /* optional */
      }

      router.replace("/lesson-plan");
      router.refresh();
    };

    void run();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
      <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
        Signing you in…
      </p>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
          <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
            Signing you in…
          </p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
