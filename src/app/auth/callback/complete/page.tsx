"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";
import { supabase } from "@/lib/supabase";

/**
 * Runs the same school-domain checks in the browser so DevTools console shows results.
 * Server route /auth/callback already applied the school plan when a match exists.
 */
export default function AuthCallbackCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
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
        console.log("School lookup error (client/RLS):", error.message);
      }

      console.log("School found:", school);

      if (school && user.data.user?.id) {
        const { error: upsertError } = await supabase.from("user_usage").upsert(
          {
            user_id: user.data.user.id,
            plan_type: school.plan_type,
            generations_limit: -1,
            generations_used: 0,
          },
          { onConflict: "user_id" },
        );

        if (upsertError) {
          console.log("user_usage upsert error (client):", upsertError.message);
        } else {
          console.log("User assigned to school plan");
        }
      }

      const params = new URLSearchParams(window.location.search);
      const welcome = params.get("school_welcome");
      if (welcome) {
        try {
          sessionStorage.setItem(SCHOOL_WELCOME_SESSION_KEY, decodeURIComponent(welcome));
        } catch {
          /* ignore */
        }
      }

      router.replace("/lesson-plan");
      router.refresh();
    };

    void run();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "#F7F9FC" }}>
      <p className="text-sm font-medium" style={{ color: "#4A5568" }}>
        Finishing sign-in…
      </p>
    </main>
  );
}
