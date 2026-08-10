"use client";

import { useEffect, useState } from "react";
import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";

export function SchoolWelcomeBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SCHOOL_WELCOME_SESSION_KEY);
      if (stored) {
        setMessage(stored);
        sessionStorage.removeItem(SCHOOL_WELCOME_SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!message) return null;

  return (
    <div
      className="mb-6 rounded-2xl border px-4 py-3 text-sm font-medium"
      style={{
        borderColor: "rgba(14, 148, 132,0.35)",
        background: "rgba(14, 148, 132,0.08)",
        color: "#0B6B5F",
      }}
      role="status"
    >
      {message}
    </div>
  );
}
