"use client";

import { useCallback, useState } from "react";
import { useErrorToast } from "@/hooks/use-error-toast";
import type { SchoolAdminDashboardData, SchoolAdminTeacher } from "@/lib/school-admin-server";
import { supabase } from "@/lib/supabase";
import { Badge, Notice, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

/** Small badge next to a teacher's name for a non-default role. */
function RoleBadge({ role }: { role: SchoolAdminTeacher["role"] }) {
  if (role === "teacher") return null;
  return <Badge tone={role === "hod" ? "brand" : "neutral"}>{role === "hod" ? "HOD" : "Admin"}</Badge>;
}

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
      <Panel className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-muted">Loading school admin…</p>
      </Panel>
    );
  }

  const { school, teachers, usage } = data;
  const seatsLabel = `${school.activeTeachers} of ${school.maxTeachers} teachers`;

  return (
    <div className="space-y-8 pb-8">
      {/* A deliberately inverted surface (bg-ink/text-inverse), same pairing
          used for PptImageProgressCard and the generation loading screen — it
          reads as a dark header in light mode and correctly flips to a light
          one in dark mode, instead of hardcoding one direction. */}
      <header className="rounded-2xl bg-ink p-6 text-inverse sm:p-8">
        <span className="mb-3 inline-flex rounded-full border border-brand bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          School Admin
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{school.name}</h1>
        <p className="mt-2 text-sm text-inverse/70">Manage teachers and monitor school usage</p>
      </header>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {roleError ? <Notice tone="danger">{roleError}</Notice> : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">School overview</h2>
        <Panel className="p-5 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">School name</dt>
              <dd className="mt-1 text-base font-semibold text-ink">{school.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Plan type</dt>
              <dd className="mt-1 text-base font-semibold text-brand-text">{formatPlanLabel(school.planType)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Active teachers (of max)</dt>
              <dd className="mt-1 text-base font-semibold text-ink">{seatsLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-faint">Email domain</dt>
              <dd className="mt-1 text-base font-semibold text-ink">@{school.emailDomain}</dd>
            </div>
          </dl>
        </Panel>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Teachers</h2>
        {teachers.length === 0 ? (
          <Panel className="p-6 text-sm text-muted">
            No teachers have joined yet. Teachers with a <strong>@{school.emailDomain}</strong> Google
            account will appear here after they sign in.
          </Panel>
        ) : (
          <>
            {/* Desktop table */}
            <Panel className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-line-subtle bg-hover hover:bg-hover">
                    <TableHead className="px-4 py-3 text-ink">Teacher name</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Email</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Join date</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Generations</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Role</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Department</TableHead>
                    <TableHead className="px-4 py-3 text-ink">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => {
                    const { role, department } = getTeacherRole(teacher);
                    const isDirty = Boolean(pendingEdits[teacher.userId]);
                    const isSaving = savingRoleId === teacher.userId;
                    const isSuccess = roleSuccessId === teacher.userId;

                    return (
                      <TableRow key={teacher.userId} className="border-line-subtle hover:bg-transparent">
                        <TableCell className="px-4 py-3 font-medium text-ink">
                          {teacher.name}
                          <span className="ml-2 inline-flex align-middle">
                            <RoleBadge role={teacher.role} />
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted">{teacher.email}</TableCell>
                        <TableCell className="px-4 py-3 text-muted">{formatDate(teacher.joinedAt)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted">{teacher.generationsUsedThisMonth}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Select
                            value={role}
                            onChange={(e) =>
                              setTeacherPending(teacher.userId, {
                                role: e.target.value as SchoolAdminTeacher["role"],
                                department: pendingEdits[teacher.userId]?.department ?? teacher.department,
                              })
                            }
                            className="h-8 min-w-[100px] text-xs"
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Select
                            value={department ?? ""}
                            onChange={(e) =>
                              setTeacherPending(teacher.userId, {
                                role: pendingEdits[teacher.userId]?.role ?? teacher.role,
                                department: e.target.value || null,
                              })
                            }
                            className="h-8 min-w-[140px] text-xs"
                          >
                            <option value="">— None —</option>
                            {DEPARTMENT_OPTIONS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isSuccess ? (
                              <span className="text-xs font-semibold text-brand-text">Role updated successfully</span>
                            ) : (
                              <Button
                                type="button"
                                variant="subtle"
                                size="sm"
                                disabled={!isDirty || isSaving}
                                onClick={() => void onSaveRole(teacher)}
                              >
                                {isSaving ? "Saving…" : "Save"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="danger-quiet"
                              size="sm"
                              disabled={removingId === teacher.userId}
                              onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                            >
                              {removingId === teacher.userId ? "Removing…" : "Remove"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Panel>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {teachers.map((teacher) => {
                const { role, department } = getTeacherRole(teacher);
                const isDirty = Boolean(pendingEdits[teacher.userId]);
                const isSaving = savingRoleId === teacher.userId;
                const isSuccess = roleSuccessId === teacher.userId;

                return (
                  <Panel key={teacher.userId} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink">{teacher.name}</p>
                        <span className="mt-1 inline-flex">
                          <RoleBadge role={teacher.role} />
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 break-all text-sm text-muted">{teacher.email}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                      <span>Joined {formatDate(teacher.joinedAt)}</span>
                      <span>·</span>
                      <span>{teacher.generationsUsedThisMonth} generations</span>
                    </div>

                    {/* Role & Department */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted">Role</label>
                        <Select
                          value={role}
                          onChange={(e) =>
                            setTeacherPending(teacher.userId, {
                              role: e.target.value as SchoolAdminTeacher["role"],
                              department: pendingEdits[teacher.userId]?.department ?? teacher.department,
                            })
                          }
                          className="h-9 w-full text-xs"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted">Department</label>
                        <Select
                          value={department ?? ""}
                          onChange={(e) =>
                            setTeacherPending(teacher.userId, {
                              role: pendingEdits[teacher.userId]?.role ?? teacher.role,
                              department: e.target.value || null,
                            })
                          }
                          className="h-9 w-full text-xs"
                        >
                          <option value="">— None —</option>
                          {DEPARTMENT_OPTIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {isSuccess ? (
                      <p className="mt-3 text-center text-xs font-semibold text-brand-text">Role updated successfully</p>
                    ) : (
                      <Button
                        type="button"
                        variant="subtle"
                        block
                        className="mt-3"
                        disabled={!isDirty || isSaving}
                        onClick={() => void onSaveRole(teacher)}
                      >
                        {isSaving ? "Saving…" : "Save Role"}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="danger-quiet"
                      block
                      className="mt-2"
                      disabled={removingId === teacher.userId}
                      onClick={() => void onRemoveTeacher(teacher.userId, teacher.name)}
                    >
                      {removingId === teacher.userId ? "Removing…" : "Remove teacher"}
                    </Button>
                  </Panel>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Usage statistics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Total generations used this month
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{usage.totalGenerationsUsedThisMonth}</p>
            <p className="mt-1 text-xs text-muted">Across all teachers in your school</p>
          </Panel>
          <Panel className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Most active teacher</p>
            {usage.mostActiveTeacher ? (
              <>
                <p className="mt-2 text-lg font-bold text-ink">{usage.mostActiveTeacher.name}</p>
                <p className="text-sm text-muted">{usage.mostActiveTeacher.email}</p>
                <p className="mt-2 text-sm font-medium text-brand-text">
                  {usage.mostActiveTeacher.generationsUsed} generations this month
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">No usage yet</p>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
