"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import { useErrorToast } from "@/hooks/use-error-toast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Badge, Notice, Spinner } from "@/components/ui/panel";
import type { SchoolAdminDashboardData, SchoolAdminTeacher } from "@/lib/school-admin-server";
import { supabase } from "@/lib/supabase";

const ROLE_OPTIONS: { value: SchoolAdminTeacher["role"]; label: string }[] = [
  { value: "teacher", label: "Teacher" }, { value: "hod", label: "HOD" }, { value: "admin", label: "Admin" },
];
const DEPARTMENT_OPTIONS = ["Science", "Mathematics", "English", "Arabic", "Islamic Studies", "Social Studies", "ICT", "Art", "Physical Education", "Moral Education"];
const fieldClass = "min-h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60";
type RoleState = { role: SchoolAdminTeacher["role"]; department: string | null };

export function SchoolAdminDashboard({ initialData }: { initialData: SchoolAdminDashboardData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useErrorToast();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SchoolAdminTeacher | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Record<string, RoleState>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [roleSuccessId, setRoleSuccessId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [refreshNotice, setRefreshNotice] = useState(false);

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
    return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };
  };

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    setRefreshNotice(false);
    try {
      const response = await fetch("/api/school-admin", { headers: await getHeaders(), cache: "no-store" });
      const json = await response.json() as SchoolAdminDashboardData & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not refresh your school. Please try again.");
      setData(json);
      setRefreshNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh your school. Please try again.");
    } finally { setLoading(false); }
  }, [setError]);

  const updatePending = (teacher: SchoolAdminTeacher, update: Partial<RoleState>) => {
    setRoleSuccessId(null);
    setPendingEdits((prev) => ({ ...prev, [teacher.userId]: { ...(prev[teacher.userId] ?? { role: teacher.role, department: teacher.department }), ...update } }));
  };

  const onSaveRole = async (teacher: SchoolAdminTeacher) => {
    const pending = pendingEdits[teacher.userId];
    if (!pending) return;
    setSavingRoleId(teacher.userId);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/teachers/${teacher.userId}`, { method: "PATCH", headers: await getHeaders(), body: JSON.stringify(pending) });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw new Error(result.error ?? "Could not update this teacher. Please try again."); }
      setData((prev) => ({ ...prev, teachers: prev.teachers.map((item) => item.userId === teacher.userId ? { ...item, ...pending } : item) }));
      setPendingEdits((prev) => { const next = { ...prev }; delete next[teacher.userId]; return next; });
      setRoleSuccessId(teacher.userId);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update this teacher."); }
    finally { setSavingRoleId(null); }
  };

  const onRemoveTeacher = async () => {
    if (!removeTarget) return;
    setRemovingId(removeTarget.userId);
    setError(null);
    try {
      const response = await fetch(`/api/school-admin/teachers/${removeTarget.userId}`, { method: "DELETE", headers: await getHeaders() });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw new Error(result.error ?? "Could not remove this teacher. Please try again."); }
      setData((prev) => ({ ...prev, school: { ...prev.school, activeTeachers: Math.max(0, prev.school.activeTeachers - 1) }, teachers: prev.teachers.filter((teacher) => teacher.userId !== removeTarget.userId) }));
      setRemoveTarget(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove this teacher."); }
    finally { setRemovingId(null); }
  };

  const { school, teachers, usage } = data;
  const departments = useMemo(() => Array.from(new Set([...DEPARTMENT_OPTIONS, ...teachers.map((teacher) => teacher.department).filter((value): value is string => Boolean(value))])).sort(), [teachers]);
  const filteredTeachers = teachers.filter((teacher) => `${teacher.name} ${teacher.email}`.toLowerCase().includes(search.trim().toLowerCase()) && (!departmentFilter || teacher.department === departmentFilter));
  const busy = savingRoleId !== null || removingId !== null;

  return (
    <div className="space-y-7">
      <header className="page-header !mb-0">
        <div><p className="page-kicker">School administration</p><h1 className="page-title">{school.name}</h1><p className="page-description">Manage your teaching team, department access, and school usage.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading || busy}><RefreshCw className={loading ? "animate-spin" : ""} />{loading ? "Refreshing..." : "Refresh"}</Button>
      </header>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {refreshNotice ? <p role="status" className="text-sm text-muted">School information is up to date.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active teachers", value: String(school.activeTeachers), detail: `${school.maxTeachers} seats in your plan` },
          { label: "Generations this month", value: String(usage.totalGenerationsUsedThisMonth), detail: "Across your school" },
          { label: "School plan", value: school.planType.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), detail: `@${school.emailDomain}` },
          { label: "Most active teacher", value: usage.mostActiveTeacher?.name ?? "No activity yet", detail: usage.mostActiveTeacher ? `${usage.mostActiveTeacher.generationsUsed} generations this month` : "Usage appears as teachers create resources" },
        ].map((stat) => <div key={stat.label} className="rounded-xl border border-line bg-surface p-5"><p className="text-sm text-muted">{stat.label}</p><p className="mt-3 break-words text-xl font-semibold tracking-tight text-ink">{stat.value}</p><p className="mt-2 break-words text-sm text-faint">{stat.detail}</p></div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-heading">Teaching team</h2><p className="mt-1 text-sm text-muted">Teachers join by signing in with their @{school.emailDomain} Google account.</p></div><Badge tone="neutral">{teachers.length} teachers</Badge></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-faint" aria-hidden /><input aria-label="Search teachers by name or email" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className={`${fieldClass} pl-10`} /></div>
            <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={`${fieldClass} sm:!w-52`}><option value="">All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
          </div>
        </div>
        {filteredTeachers.length === 0 ? (
          <div className="px-6 py-14 text-center"><Users className="mx-auto mb-4 size-8 text-faint" aria-hidden /><p className="font-medium text-ink">{teachers.length === 0 ? "Your teaching team starts here" : "No matching teachers"}</p><p className="mt-2 text-sm text-muted">{teachers.length === 0 ? `Ask teachers to sign in with their @${school.emailDomain} Google account.` : "Try another name or department."}</p>{teachers.length > 0 && <Button className="mt-4" variant="ghost" onClick={() => { setSearch(""); setDepartmentFilter(""); }}>Clear filters</Button>}</div>
        ) : (
          <div className="divide-y divide-line">
            <div className="hidden grid-cols-[minmax(180px,1.4fr)_110px_minmax(260px,1.3fr)_140px] gap-4 bg-sunken px-6 py-3 text-sm font-medium text-muted xl:grid"><span>Teacher</span><span>This month</span><span>Role and department</span><span className="text-right">Actions</span></div>
            {filteredTeachers.map((teacher) => {
              const pending = pendingEdits[teacher.userId] ?? { role: teacher.role, department: teacher.department };
              const dirty = pending.role !== teacher.role || pending.department !== teacher.department;
              return (
                <div key={teacher.userId} className="grid items-center gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(180px,1.4fr)_110px_minmax(260px,1.3fr)_140px]">
                  <div className="min-w-0"><p className="font-medium text-ink">{teacher.name}</p><p className="mt-1 break-all text-sm text-muted">{teacher.email}</p><p className="mt-1 text-sm text-faint">Joined {new Date(teacher.joinedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p></div>
                  <p className="text-sm tabular-nums text-muted">{teacher.generationsUsedThisMonth}<span className="ml-1 xl:hidden">generations this month</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="mb-1 block text-sm text-muted xl:sr-only" htmlFor={`role-${teacher.userId}`}>Role for {teacher.name}</label><select id={`role-${teacher.userId}`} value={pending.role} disabled={busy} onChange={(event) => updatePending(teacher, { role: event.target.value as RoleState["role"] })} className={fieldClass}>{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                    <div><label className="mb-1 block text-sm text-muted xl:sr-only" htmlFor={`department-${teacher.userId}`}>Department for {teacher.name}</label><select id={`department-${teacher.userId}`} value={pending.department ?? ""} disabled={busy} onChange={(event) => updatePending(teacher, { department: event.target.value || null })} className={fieldClass}><option value="">No department</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {roleSuccessId === teacher.userId ? <span role="status" className="text-sm text-brand-text">Saved</span> : <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || busy} onClick={() => void onSaveRole(teacher)}>{savingRoleId === teacher.userId ? <Spinner className="size-4" /> : "Save"}</Button>}
                    <Button size="sm" variant="danger-quiet" disabled={busy} onClick={() => setRemoveTarget(teacher)}>Remove</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmDialog open={removeTarget !== null} busy={removingId !== null} title="Remove this teacher?" description={`${removeTarget?.name ?? "This teacher"} will leave your school workspace and move to an individual free plan.`} confirmLabel="Remove teacher" onConfirm={() => void onRemoveTeacher()} onCancel={() => setRemoveTarget(null)} />
    </div>
  );
}
