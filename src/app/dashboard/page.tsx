"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeGooglePostAuthLogin } from "@/lib/auth-post-login";
import { resolveGoogleOAuthSession } from "@/lib/google-oauth-callback";
import { supabase } from "@/lib/supabase";

/** Google OAuth redirect target — exchange code, detect school domain, then enter app. */
export default function DashboardPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in…");
  const processingRef = useRef(false);

  useEffect(() => {
    const finishGoogleLogin = async () => {
      if (processingRef.current) return;

      const session = await resolveGoogleOAuthSession();

      if (!session?.user?.email) {
        return;
      }

      processingRef.current = true;

      const email = session.user.email;
      console.log("[google-oauth] Callback — running school domain check", { email });

      const postAuth = await completeGooglePostAuthLogin(session.user.id, email);
      if (!postAuth.ok) {
        setStatus(postAuth.message);
        router.replace(`/auth?error=${encodeURIComponent(postAuth.message)}`);
        return;
      }

      router.replace("/lesson-plan");
      router.refresh();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.email) {
        void finishGoogleLogin();
      }
    });

    void (async () => {
      await finishGoogleLogin();
      if (!processingRef.current) {
        setStatus("Redirecting to login…");
        router.replace("/auth");
      }
    })();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
      <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
        {status}
      </p>
    </main>
  );
}
