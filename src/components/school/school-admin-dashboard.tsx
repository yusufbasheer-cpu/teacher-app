"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SchoolAdminDashboard } from "@/lib/school-admin-server";
import { supabase } from "@/lib/supabase";

function formatPlanLabel(planType: string): string {
  return planType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SchoolAdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<SchoolAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/auth");
      return;
    }

    const response = await fetch("/api/school-admin", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (response.status === 403) {
      router.replace("/lesson-plan");
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not load school admin data.");
      setLoading(false);
      return;
    }

    const json = (await response.json()) as SchoolAdminDashboard;
    setData(json);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRemoveTeacher = async (userId: string, teacherEmail: string) => {
    if (
      !window.confirm(
        `Remove ${teacherEmail} from your school account? They will be moved to an individual free plan.`,
      )
    ) {
      return;
    }

    setRemovingId(userId);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Session expired. Please log in again.");
      setRemovingId(null);
      return;
    }

    const response = await fetch(`/api/school-admin/teachers/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not remove teacher.");
      setRemovingId(null);
      return;
    }

    setRemovingId(null);
    setLoading(true);
    await load();
  };

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "#4A5568" }}>
        Loading school dashboard…
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-red-600">{error ?? "School dashboard unavailable."}</p>
    );
  }

  const { school, teachers, usage } = data;
  const seatsLabel = `${school.activeTeachers} of ${school.maxTeachers} teachers`;

  return (
    <div className="space-y-8">
      <header>
        <p
          className="mb-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: "#00C6A7", color: "#00C6A7", background: "rgba(0,198,167,0.08)" }}
        >
          School Admin
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0A1628" }}>
          {school.name}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#4A5568" }}>
          Plan: {formatPlanLabel(school.planType)} · Domain: @{school.emailDomain}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(0,198,167,0.2)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
            Teachers joined
          </p>
          <p className="mt-2 text-2xl font-bold" style={{ color: "#0A1628" }}>
            {seatsLabel}
          </p>
        </div>
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(0,198,167,0.2)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
            Total generations
          </p>
          <p className="mt-2 text-2xl font-bold" style={{ color: "#0A1628" }}>
            {usage.totalGenerationsUsed}
          </p>
        </div>
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(0,198,167,0.2)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
            Lesson plans saved
          </p>
          <p className="mt-2 text-2xl font-bold" style={{ color: "#0A1628" }}>
            {usage.totalLessonPlans}
          </p>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "#0A1628" }}>
          Teachers
        </h2>
        {teachers.length === 0 ? (
          <p className="text-sm" style={{ color: "#4A5568" }}>
            No teachers have joined yet. Teachers with an @{school.emailDomain} email will be added
            automatically when they sign in.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm" style={{ borderColor: "rgba(0,198,167,0.2)" }}>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#E2E8F0" }}>
                  <th className="px-4 py-3 font-semibold" style={{ color: "#0A1628" }}>
                    Email
                  </th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "#0A1628" }}>
                    Joined
                  </th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "#0A1628" }}>
                    Generations
                  </th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "#0A1628" }}>
                    Lesson plans
                  </th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "#0A1628" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.userId} className="border-b last:border-b-0" style={{ borderColor: "#E2E8F0" }}>
                    <td className="px-4 py-3" style={{ color: "#4A5568" }}>
                      {teacher.email}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#4A5568" }}>
                      {new Date(teacher.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#4A5568" }}>
                      {teacher.generationsLimit < 0
                        ? `${teacher.generationsUsed} (unlimited)`
                        : `${teacher.generationsUsed} / ${teacher.generationsLimit}`}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#4A5568" }}>
                      {teacher.lessonPlansCount}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={removingId === teacher.userId}
                        onClick={() => void onRemoveTeacher(teacher.userId, teacher.email)}
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {removingId === teacher.userId ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
