"use client";

import { useEffect, useState } from "react";
import { SCHOOL_WELCOME_SESSION_KEY } from "@/lib/school-accounts";
import { Notice } from "@/components/ui/panel";

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
    <Notice tone="brand" className="mb-6 font-medium" role="status">
      {message}
    </Notice>
  );
}
