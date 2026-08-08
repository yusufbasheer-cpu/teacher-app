"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerActiveSession } from "@/lib/active-session";
import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";
import { supabase } from "@/lib/supabase";

function DashboardContent() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [adminDenied, setAdminDenied] = useState(false);
  const [hodDeniedState, setHodDeniedState] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const params =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

      const denied =
        params?.get("admin_denied") === "1" ||
        params?.get("access_denied") === "1" ||
        params?.get("hod_denied") === "1";
      const hodDenied = params?.get("hod_denied") === "1";

      const code = params?.get("code");
      if (code) {
        router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      // School plan assignment already happened server-side in
      // /api/auth/callback (via applySchoolPlanForEmail, using the service
      // role) before redirecting here with ?school_check=1 — this used to
      // also re-fetch the school and upsert user_usage client-side, which
      // was both redundant and a direct write to user_usage from the
      // browser using the public anon key + the user's own JWT. Only the
      // "show the welcome banner" bookkeeping is still needed here.
      const schoolCheck = params?.get("school_check") === "1";
      if (schoolCheck) {
        // Applying the school plan onto user_usage happens server-side in /auth/callback
        // (via the service-role client, see applySchoolPlanForEmail) before this page ever
        // loads -- the client no longer has a write path to user_usage to duplicate that here.
        const welcome = params?.get("school_welcome");
        if (welcome) {
          try {
            sessionStorage.setItem(SCHOOL_WELCOME_SESSION_KEY, decodeURIComponent(welcome));
          } catch {
            /* ignore */
          }
        }
      }

      await registerActiveSession(session.user.id);

      fetch("/api/welcome-email", { method: "POST" }).catch(() => {});

      if (denied) {
        setAdminDenied(true);
        if (hodDenied) setHodDeniedState(true);
        window.history.replaceState(null, "", "/dashboard");
        return;
      }

      router.replace("/lesson-plan");
      router.refresh();
    };

    void run();
  }, [router]);

  if (adminDenied) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: "#F7F9FC" }}
      >
        <div
          className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"
          style={{ borderColor: "rgba(0,198,167,0.25)" }}
        >
          <p className="text-lg font-semibold" style={{ color: "#0A1628" }}>
            {hodDeniedState ? "Access restricted to Department Heads" : "You do not have admin access"}
          </p>
          <p className="mt-2 text-sm" style={{ color: "#4A5568" }}>
            {hodDeniedState
              ? "Only teachers with the HOD role can access the HOD Dashboard."
              : "Your account is not listed as a school administrator."}
          </p>
          <Link
            href="/lesson-plan"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "#00C6A7" }}
          >
            Go to lesson plan generator
          </Link>
        </div>
      </main>
    );
  }

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
