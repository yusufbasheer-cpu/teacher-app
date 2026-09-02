"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Workspace } from "@/components/dashboard/workspace";
import { Skeleton } from "@/components/ui/panel";

/**
 * Resolves the browser-side session for the dashboard.
 *
 * The route is already gated server-side by `getVerifiedUser`, so this is not
 * an auth check — it only supplies the `User` object the workspace needs for
 * the greeting and its Supabase queries. While it resolves we hold the
 * workspace's shape rather than showing a spinner, so nothing shifts when the
 * real content lands.
 */
export function WorkspaceClient() {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    })();
  }, []);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-6 sm:py-8" aria-hidden>
        <Skeleton className="mb-5 h-6 w-52" />
        <Skeleton className="h-[188px] w-full rounded-lg" />
        <Skeleton className="mt-6 h-4 w-32" />
        <Skeleton className="mt-2 h-[140px] w-full rounded-lg" />
      </div>
    );
  }

  return <Workspace user={user} />;
}
