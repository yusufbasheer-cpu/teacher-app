"use client";

import { useCallback, useState } from "react";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { SchoolAdminDashboardData, SchoolAdminTeacher } from "@/lib/school-admin-server";
import { supabase } from "@/lib/supabase";

const NAVY = "var(--text)";
const TEAL = "var(--brand)";
const MUTED = "var(--text-secondary)";

const ROLE_OPTIONS: { value: SchoolAdminTeacher["role"]; label: string }[] = [
  { value: "teacher", label: "Teacher" },
  { value: "hod", label: "HOD" },
  { value: "admin", label: "Admin" },
];

const DEPARTMENT_OPTIONS = [
  "Science",
  "Mathematics",
  "English",
  "Arabic",
  "Islamic Studies",
  "Social Studies",
  "ICT",
  "Art",
  "Physical Education",
  "Moral Education",
];

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

type RoleState = { role: SchoolAdminTeacher["role"]; department: string | null };

type SchoolAdminDashboardProps = {
  initialData: SchoolAdminDashboardData;
};

export function SchoolAdminDashboard({ initialData }: SchoolAdminDashboardProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useErrorToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Per-teacher pending role/department edits
  const [pendingEdits, setPendingEdits] = useState<Record<string, RoleState>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleSuccessId, setRoleSuccessId] = useState<string | null>(null);
  const [roleError, setRoleError] = useErrorToast();

  const getTeacherRole = (teacher: SchoolAdminTeacher): RoleState =>
    pendingEdits[teacher.userId] ?? { role: teacher.role, department: teacher.department };

  const setTeacherPending = (userId: string, update: Partial<RoleState>) => {
    setPendingEdits((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? { role: "teacher", department: null }), ...update },
    }));
  };

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    const session = await getSession();
    if (!session?.access_token) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/school-admin", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not load school admin data.");
      setLoading(false);
      return;
    }

    const json = (await response.json()) as SchoolAdminDashboardData;
    setData(json);
    setPendingEdits({});
    setLoading(false);
  }, []);

  const onSaveRole = async (teacher: SchoolAdminTeacher) => {
    const pending = pendingEdits[teacher.userId];
    if (!pending) return;

    setSavingRoleId(teacher.userId);
    setRoleError(null);
    setRoleSuccessId(null);

    const session = await getSession();
    if (!session?.access_token) {
      setRoleError("Session expired. Please log in again.");
      setSavingRoleId(null);
      return;
    }

    const response = await fetch(`/api/school-admin/teachers/${teacher.userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ role: pending.role, department: pending.department }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setRoleError(body.error ?? "Could not update role.");
      setSavingRoleId(null);
      return;
    }

    setSavingRoleId(null);
    setRoleSuccessId(teacher.userId);
    // Clear success after 3s
    setTimeout(() => setRoleSuccessId((id) => (id === teacher.userId ? null : id)), 3000);
    // Update local data to reflect saved values without full reload
    setData((prev) => ({
      ...prev,
      teachers: prev.teachers.map((t) =>
        t.userId === teacher.userId
          ? { ...t, role: pending.role, department: pending.department }
          : t
      ),
    }));
    setPendingEdits((prev) => {
      const next = { ...prev };
      delete next[teacher.userId];
      return next;
    });
  };

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

    const session = await getSession();
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
        style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)", background: "var(--surface-raised)" }}
      >
        <p className="text-sm font-medium" style={{ color: MUTED }}>
          Loading school admin…
        </p>
      </div>
    );
  }

  const { school, teachers, usage } = data;
  const seatsLabel = `${school.activeTeachers} of ${school.maxTeachers} teachers`;

  return (
    <div className="space-y-8 pb-8">
      <header
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, var(--l-gray-11) 55%, color-mix(in oklch, var(--brand) 15%, transparent) 100%)`,
          color: "white",
        }}
      >
        <p
          className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: TEAL, color: TEAL, background: "color-mix(in oklch, var(--brand) 12%, transparent)" }}
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

      {roleError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {roleError}
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          School overview
        </h2>
        <div
          className="rounded-2xl border bg-[var(--surface)] p-5 shadow-sm sm:p-6"
          style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
                School name
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: NAVY }}>
                {school.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
                Plan type
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: TEAL }}>
                {formatPlanLabel(school.planType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
                Active teachers (of max)
              </dt>
              <dd className="mt-1 text-base font-semibold" style={{ color: NAVY }}>
                {seatsLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
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
          Teachers
        </h2>
        {teachers.length === 0 ? (
          <div
            className="rounded-2xl border bg-[var(--surface)] p-6 text-sm"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)", color: MUTED }}
          >
            No teachers have joined yet. Teachers with a{" "}
            <strong>@{school.emailDomain}</strong> Google account will appear here after they sign
            in.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border bg-[var(--surface)] shadow-sm md:block" style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-hover" style={{ borderColor: "var(--border)" }}>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Teacher name</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Email</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Join date</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Generations</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Role</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Department</th>
                    <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => {
                    const { role, department } = getTeacherRole(teacher);
                    const isDirty = Boolean(pendingEdits[teacher.userId]);
                    const isSaving = savingRoleId === teacher.userId;
                    const isSuccess = roleSuccessId === teacher.userId;

                    return (
                      <tr key={teacher.userId} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: NAVY }}>
                          {teacher.name}
                          {teacher.role === "hod" && (
                            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in oklch, var(--brand) 12%, transparent)", color: TEAL }}>HOD</span>
                          )}
                          {teacher.role === "admin" && (
                            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in oklch, var(--text) 8%, transparent)", color: NAVY }}>Admin</span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{teacher.email}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{formatDate(teacher.joinedAt)}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{teacher.generationsUsedThisMonth}</td>
                        <td className="px-4 py-3">
                          <select
                            value={role}
                            onChange={(e) =>
                              setTeacherPending(teacher.userId, {
                                role: e.target.value as SchoolAdminTeacher["role"],
                                department: pendingEdits[teacher.userId]?.department ?? teacher.department,
                              })
                            }
                            className="rounded-lg border border-line-strong px-2 py-1.5 text-xs outline-none focus:ring-2"
                            style={{ color: NAVY, minWidth: 90 }}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={department ?? ""}
                            onChange={(e) =>
                              setTeacherPending(teacher.userId, {
                                role: pendingEdits[teacher.userId]?.role ?? teacher.role,
                                department: e.target.value || null,
                              })
                            }
                            className="rounded-lg border border-line-strong px-2 py-1.5 text-xs outline-none focus:ring-2"
                            style={{ color: NAVY, minWidth: 130 }}
                          >
                            <option value="">— None —</option>
                            {DEPARTMENT_OPTIONS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isSuccess ? (
                              <span className="text-xs font-semibold" style={{ color: TEAL }}>
                                Role updated successfully
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!isDirty || isSaving}
                                onClick={() => void onSaveRole(teacher)}
                                className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40"
                                style={
                                  isDirty && !isSaving
                                    ? { borderColor: TEAL, color: TEAL, background: "color-mix(in oklch, var(--brand) 7%, transparent)" }
                                    : { borderColor: "#D9CCB8", color: "var(--text-disabled)" }
                                }
                              >
                                {isSaving ? "Saving…" : "Save"}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={removingId === teacher.userId}
                              onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {removingId === teacher.userId ? "Removing…" : "Remove"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {teachers.map((teacher) => {
                const { role, department } = getTeacherRole(teacher);
                const isDirty = Boolean(pendingEdits[teacher.userId]);
                const isSaving = savingRoleId === teacher.userId;
                const isSuccess = roleSuccessId === teacher.userId;

                return (
                  <div
                    key={teacher.userId}
                    className="rounded-2xl border bg-[var(--surface)] p-4 shadow-sm"
                    style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold" style={{ color: NAVY }}>{teacher.name}</p>
                        {teacher.role !== "teacher" && (
                          <span
                            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={
                              teacher.role === "hod"
                                ? { background: "color-mix(in oklch, var(--brand) 12%, transparent)", color: TEAL }
                                : { background: "color-mix(in oklch, var(--text) 8%, transparent)", color: NAVY }
                            }
                          >
                            {teacher.role === "hod" ? "HOD" : "Admin"}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-sm break-all" style={{ color: MUTED }}>{teacher.email}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: MUTED }}>
                      <span>Joined {formatDate(teacher.joinedAt)}</span>
                      <span>·</span>
                      <span>{teacher.generationsUsedThisMonth} generations</span>
                    </div>

                    {/* Role & Department */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold" style={{ color: MUTED }}>Role</label>
                        <select
                          value={role}
                          onChange={(e) =>
                            setTeacherPending(teacher.userId, {
                              role: e.target.value as SchoolAdminTeacher["role"],
                              department: pendingEdits[teacher.userId]?.department ?? teacher.department,
                            })
                          }
                          className="w-full rounded-lg border border-line-strong px-2 py-2 text-xs outline-none"
                          style={{ color: NAVY }}
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold" style={{ color: MUTED }}>Department</label>
                        <select
                          value={department ?? ""}
                          onChange={(e) =>
                            setTeacherPending(teacher.userId, {
                              role: pendingEdits[teacher.userId]?.role ?? teacher.role,
                              department: e.target.value || null,
                            })
                          }
                          className="w-full rounded-lg border border-line-strong px-2 py-2 text-xs outline-none"
                          style={{ color: NAVY }}
                        >
                          <option value="">— None —</option>
                          {DEPARTMENT_OPTIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isSuccess ? (
                      <p className="mt-3 text-center text-xs font-semibold" style={{ color: TEAL }}>
                        Role updated successfully
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={!isDirty || isSaving}
                        onClick={() => void onSaveRole(teacher)}
                        className="mt-3 w-full rounded-lg border py-2 text-sm font-semibold transition disabled:opacity-40"
                        style={
                          isDirty && !isSaving
                            ? { borderColor: TEAL, color: TEAL, background: "color-mix(in oklch, var(--brand) 7%, transparent)" }
                            : { borderColor: "#D9CCB8", color: "var(--text-disabled)" }
                        }
                      >
                        {isSaving ? "Saving…" : "Save Role"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={removingId === teacher.userId}
                      onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                      className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {removingId === teacher.userId ? "Removing…" : "Remove teacher"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
          Usage statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl border bg-[var(--surface)] p-5 shadow-sm"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Total generations used this month
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: NAVY }}>
              {usage.totalGenerationsUsedThisMonth}
            </p>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              Across all teachers in your school
            </p>
          </div>
          <div
            className="rounded-2xl border bg-[var(--surface)] p-5 shadow-sm"
            style={{ borderColor: "color-mix(in oklch, var(--brand) 25%, transparent)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
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
    </div>
  );
}
