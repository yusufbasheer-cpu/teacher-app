"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SchoolAdminDashboard } from "@/lib/school-admin-server";
import { supabase } from "@/lib/supabase";

const NAVY = "#0A1628";
const TEAL = "#00C6A7";
const MUTED = "#4A5568";

function formatPlanLabel(planType: string): string {
  return planType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      router.replace("/dashboard");
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

  const onRemoveTeacher = async (userId: string, teacherName: string) => {
    if (
      !window.confirm(
        `Remove ${teacherName} from your school? They will be moved to an individual free plan.`,
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
      <div
        className="flex min-h-[40vh] items-center justify-center rounded-2xl border"
        style={{ borderColor: "rgba(0,198,167,0.25)", background: "white" }}
      >
        <p className="text-sm font-medium" style={{ color: MUTED }}>
          Loading school admin…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "School dashboard unavailable."}
      </div>
    );
  }

  const { school, teachers, usage } = data;
  const seatsLabel = `${school.activeTeachers} of ${school.maxTeachers}`;

  return (
    <div className="space-y-8 pb-8">
      <header
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #0d2040 55%, rgba(0,198,167,0.15) 100%)`,
          color: "white",
        }}
      >
        <p
          className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: TEAL, color: TEAL, background: "rgba(0,198,167,0.12)" }}
        >
          School Admin
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
        <p className="mt-2 text-sm text-white/70">Manage teachers and monitor school usage</p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          School overview
        </h2>
        <div
          className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
          style={{ borderColor: "rgba(0,198,167,0.25)" }}
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                School name
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: NAVY }}>
                {school.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Plan type
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: TEAL }}>
                {formatPlanLabel(school.planType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active teachers
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: NAVY }}>
                {seatsLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email domain
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: NAVY }}>
                @{school.emailDomain}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          Usage statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl border bg-white p-5 shadow-sm"
            style={{ borderColor: "rgba(0,198,167,0.25)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total generations this month
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
              {usage.totalGenerationsUsedThisMonth}
            </p>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              Used by all teachers in your school
            </p>
          </div>
          <div
            className="rounded-2xl border bg-white p-5 shadow-sm"
            style={{ borderColor: "rgba(0,198,167,0.25)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Most active teacher
            </p>
            {usage.mostActiveTeacher ? (
              <>
                <p className="mt-2 text-lg font-bold" style={{ color: NAVY }}>
                  {usage.mostActiveTeacher.name}
                </p>
                <p className="text-sm" style={{ color: MUTED }}>
                  {usage.mostActiveTeacher.email}
                </p>
                <p className="mt-2 text-sm font-medium" style={{ color: TEAL }}>
                  {usage.mostActiveTeacher.generationsUsed} generations this month
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm" style={{ color: MUTED }}>
                No usage yet
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          Teachers
        </h2>
        {teachers.length === 0 ? (
          <div
            className="rounded-2xl border bg-white p-6 text-sm"
            style={{ borderColor: "rgba(0,198,167,0.25)", color: MUTED }}
          >
            No teachers have joined yet. Teachers with a{" "}
            <strong>@{school.emailDomain}</strong> Google account will appear here after they sign
            in.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border bg-white shadow-sm md:block" style={{ borderColor: "rgba(0,198,167,0.25)" }}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50" style={{ borderColor: "#E2E8F0" }}>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      Teacher name
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      Email
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      Join date
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      Generations this month
                    </th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr
                      key={teacher.userId}
                      className="border-b last:border-b-0"
                      style={{ borderColor: "#E2E8F0" }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: NAVY }}>
                        {teacher.name}
                      </td>
                      <td className="px-4 py-3" style={{ color: MUTED }}>
                        {teacher.email}
                      </td>
                      <td className="px-4 py-3" style={{ color: MUTED }}>
                        {formatDate(teacher.joinedAt)}
                      </td>
                      <td className="px-4 py-3" style={{ color: MUTED }}>
                        {teacher.generationsUsedThisMonth}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={removingId === teacher.userId}
                          onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {removingId === teacher.userId ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {teachers.map((teacher) => (
                <div
                  key={teacher.userId}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                  style={{ borderColor: "rgba(0,198,167,0.25)" }}
                >
                  <p className="font-semibold" style={{ color: NAVY }}>
                    {teacher.name}
                  </p>
                  <p className="mt-1 text-sm break-all" style={{ color: MUTED }}>
                    {teacher.email}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: MUTED }}>
                    <span>Joined {formatDate(teacher.joinedAt)}</span>
                    <span>·</span>
                    <span>{teacher.generationsUsedThisMonth} generations</span>
                  </div>
                  <button
                    type="button"
                    disabled={removingId === teacher.userId}
                    onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                    className="mt-4 w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {removingId === teacher.userId ? "Removing…" : "Remove teacher"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
