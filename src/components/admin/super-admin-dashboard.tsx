"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckField } from "@/components/ui/field";
import { UsersPanel } from "@/components/admin/users-panel";
import { BillingPanel } from "@/components/admin/billing-panel";
import { AnalyticsPanel } from "@/components/admin/analytics-panel";
import { AnnouncementsPanel } from "@/components/admin/announcements-panel";
import { AdminShell, type AdminTab } from "@/components/admin/ui/admin-shell";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminProviders,
  AdminSelect,
  Badge,
  EmptyState,
  INK,
  INK_FAINT,
  INK_MUTED,
  BORDER,
  FONT_MONO,
  SectionHeader,
  StatCard,
  formatAdminDate,
  formatPlanLabel,
  useActionDialog,
} from "@/components/admin/ui/admin-kit";

// Mirrors ADMIN_PERMISSIONS in src/lib/super-admin.ts — kept as a plain
// local list (not imported) since that file also exports server-only
// helpers backed by the service-role key and must never enter a client bundle.
const ADMIN_PERMISSIONS = [
  "billing.refund",
  "billing.subscription_manage",
  "billing.retry_notify",
  "user.suspend",
  "user.delete",
  "user.impersonate",
  "school.manage",
  "content.moderate",
  "notifications.broadcast",
] as const;

type Stats = {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  totalSchools: number;
  pendingSchools: number;
  totalGenerationsToday: number;
};

type PendingReg = {
  id: string;
  school_name: string;
  email_domain: string;
  plan_selected: string;
  num_teachers: string;
  admin_email: string;
  phone: string;
  country: string;
  created_at: string;
};

type School = {
  id: string;
  school_name: string;
  email_domain: string;
  plan_type: string;
  active_teachers: number;
  max_teachers: number;
  admin_email: string;
  created_at: string;
  status: "active" | "inactive";
};

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  planType: string;
  generationsUsed: number;
  generationsLimit: number;
};

type AdminRow = {
  userId: string;
  email: string;
  role: "super_admin" | "admin";
  grantedAt: string;
  permissions: string[];
};

type ContentType = "lesson_plan" | "question_paper" | "differentiated_pack";

type ContentItem = {
  id: string;
  user_id: string;
  userEmail: string;
  subject: string | null;
  grade: string | null;
  topic: string | null;
  curriculum: string | null;
  flagged: boolean;
  flagged_reason: string | null;
  created_at: string;
};

type SchoolTeacher = {
  id: string;
  user_id: string;
  email: string;
  role: "teacher" | "hod" | "admin";
  department: string | null;
  joined_at: string;
  generations_used_this_month: number;
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  lesson_plan: "Lesson Plans",
  question_paper: "Question Papers",
  differentiated_pack: "Differentiated Packs",
};

async function postJson(url: string, body?: unknown, method: "POST" | "DELETE" = "POST") {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; [k: string]: unknown };
  if (!res.ok) return { ok: false as const, error: data.error ?? "Something went wrong." };
  return { ok: true as const, data };
}

function DashboardBody({ role, email }: { role: "super_admin" | "admin"; email: string }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingReg[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<"admin" | "super_admin">("admin");
  const [grantPermissions, setGrantPermissions] = useState<Set<string>>(new Set());
  const [contentType, setContentType] = useState<ContentType>("lesson_plan");
  const [contentSearch, setContentSearch] = useState("");
  const [contentFlaggedOnly, setContentFlaggedOnly] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [expandedSchoolId, setExpandedSchoolId] = useState<string | null>(null);
  const [schoolTeachers, setSchoolTeachers] = useState<SchoolTeacher[]>([]);
  const [schoolDetailLoading, setSchoolDetailLoading] = useState(false);

  const actionDialog = useActionDialog();

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/super-admin/stats");
    if (res.ok) setStats((await res.json()) as Stats);
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch("/api/super-admin/pending");
    if (res.ok) setPending(((await res.json()) as { registrations: PendingReg[] }).registrations);
  }, []);

  const fetchSchools = useCallback(async () => {
    const res = await fetch("/api/super-admin/schools");
    if (res.ok) setSchools(((await res.json()) as { schools: School[] }).schools);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/super-admin/users");
    if (res.ok) setUsers(((await res.json()) as { users: UserRow[] }).users);
  }, []);

  const fetchAdmins = useCallback(async () => {
    const res = await fetch("/api/super-admin/admins");
    if (res.ok) setAdmins(((await res.json()) as { admins: AdminRow[] }).admins);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchPending(), fetchSchools(), fetchUsers(), fetchAdmins()]);
      setLoading(false);
    };
    void load();
  }, [fetchStats, fetchPending, fetchSchools, fetchUsers, fetchAdmins]);

  const fetchContent = useCallback(async () => {
    setContentLoading(true);
    const params = new URLSearchParams({ type: contentType });
    if (contentSearch.trim()) params.set("search", contentSearch.trim());
    if (contentFlaggedOnly) params.set("flagged", "1");
    const res = await fetch(`/api/super-admin/content?${params.toString()}`);
    if (res.ok) setContentItems(((await res.json()) as { items: ContentItem[] }).items);
    setContentLoading(false);
  }, [contentType, contentSearch, contentFlaggedOnly]);

  useEffect(() => {
    if (tab === "content") void fetchContent();
  }, [tab, fetchContent]);

  const fetchSchoolTeachers = async (schoolId: string) => {
    setSchoolDetailLoading(true);
    const res = await fetch(`/api/super-admin/schools/${schoolId}`);
    if (res.ok) setSchoolTeachers(((await res.json()) as { teachers: SchoolTeacher[] }).teachers);
    setSchoolDetailLoading(false);
  };

  const toggleSchoolExpanded = async (schoolId: string) => {
    if (expandedSchoolId === schoolId) {
      setExpandedSchoolId(null);
      setSchoolTeachers([]);
      return;
    }
    setExpandedSchoolId(schoolId);
    setSchoolTeachers([]);
    await fetchSchoolTeachers(schoolId);
  };

  // ---- Pending school registrations -------------------------------------

  const openApprove = (reg: PendingReg) => {
    actionDialog.open({
      title: "Approve school registration",
      description: "Creates the school account and sends an activation email.",
      confirmLabel: "Approve school",
      summary: [
        { label: "School", value: reg.school_name },
        { label: "Domain", value: `@${reg.email_domain}` },
        { label: "Plan", value: reg.plan_selected },
      ],
      run: async () => {
        setActionLoading(reg.id);
        const result = await postJson("/api/super-admin/approve", { registrationId: reg.id });
        setActionLoading(null);
        if (!result.ok) return result;
        await Promise.all([fetchPending(), fetchSchools(), fetchStats()]);
        return { ok: true, message: `${reg.school_name} approved.` };
      },
    });
  };

  const openReject = (reg: PendingReg) => {
    actionDialog.open({
      title: "Reject school registration",
      tone: "danger",
      confirmLabel: "Reject",
      summary: [{ label: "School", value: reg.school_name }, { label: "Domain", value: `@${reg.email_domain}` }],
      fields: [{ kind: "reason", label: "Reason (sent to the applicant)" }],
      run: async (values) => {
        setActionLoading(reg.id);
        const result = await postJson("/api/super-admin/reject", { registrationId: reg.id, reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        await Promise.all([fetchPending(), fetchStats()]);
        return { ok: true, message: "Registration rejected." };
      },
    });
  };

  // ---- Schools ------------------------------------------------------------

  const openDeactivate = (s: School) => {
    actionDialog.open({
      title: "Deactivate school",
      tone: "danger",
      description: "Teachers stop getting this school's plan synced on login until reactivated.",
      confirmLabel: "Deactivate",
      summary: [{ label: "School", value: s.school_name }],
      fields: [{ kind: "reason" }],
      run: async (values) => {
        setActionLoading(s.id);
        const result = await postJson("/api/super-admin/deactivate-school", { schoolId: s.id, reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        await Promise.all([fetchSchools(), fetchStats()]);
        return { ok: true, message: `${s.school_name} deactivated.` };
      },
    });
  };

  const openReactivate = (s: School) => {
    actionDialog.open({
      title: "Reactivate school",
      description: "Teachers will start getting this school's plan synced again on login.",
      confirmLabel: "Reactivate",
      summary: [{ label: "School", value: s.school_name }],
      run: async () => {
        setActionLoading(s.id);
        const result = await postJson("/api/super-admin/reactivate-school", { schoolId: s.id });
        setActionLoading(null);
        if (!result.ok) return result;
        await Promise.all([fetchSchools(), fetchStats()]);
        return { ok: true, message: `${s.school_name} reactivated.` };
      },
    });
  };

  const handleAssignSchoolAdmin = async (schoolId: string, userId: string) => {
    setActionLoading(userId);
    const result = await postJson(`/api/super-admin/schools/${schoolId}/admins`, { userId });
    setActionLoading(null);
    if (!result.ok) toast.error(result.error);
    else await fetchSchoolTeachers(schoolId);
  };

  const openRemoveSchoolAdmin = (schoolId: string, t: SchoolTeacher) => {
    actionDialog.open({
      title: "Remove school-admin status",
      tone: "danger",
      confirmLabel: "Remove",
      summary: [{ label: "Teacher", value: t.email }],
      run: async () => {
        setActionLoading(t.user_id);
        const result = await postJson(`/api/super-admin/schools/${schoolId}/admins/${t.user_id}`, undefined, "DELETE");
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchSchoolTeachers(schoolId);
        return { ok: true, message: "School-admin status removed." };
      },
    });
  };

  // ---- Admins ---------------------------------------------------------------

  const togglePermission = (permission: string) => {
    setGrantPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const openGrantAdmin = () => {
    const email = grantEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter the person's email first.");
      return;
    }
    const match = users.find((u) => u.email.toLowerCase() === email);
    if (!match) {
      toast.error("No signed-up user found with that email — they need to create a Layah account first.");
      return;
    }
    actionDialog.open({
      title: "Grant admin access",
      confirmLabel: "Grant access",
      summary: [
        { label: "Email", value: email },
        { label: "Role", value: grantRole === "super_admin" ? "Super Admin" : "Admin" },
        ...(grantRole === "admin" ? [{ label: "Permissions", value: grantPermissions.size ? Array.from(grantPermissions).join(", ") : "None" }] : []),
      ],
      run: async () => {
        setActionLoading("grant");
        const result = await postJson("/api/super-admin/admins/grant", {
          userId: match.id,
          role: grantRole,
          permissions: Array.from(grantPermissions),
        });
        setActionLoading(null);
        if (!result.ok) return result;
        setGrantEmail("");
        setGrantPermissions(new Set());
        await fetchAdmins();
        return { ok: true, message: `Access granted to ${email}.` };
      },
    });
  };

  const openRevokeAdmin = (a: AdminRow) => {
    actionDialog.open({
      title: "Revoke admin access",
      tone: "danger",
      confirmLabel: "Revoke",
      summary: [{ label: "Email", value: a.email }],
      run: async () => {
        setActionLoading(a.userId);
        const result = await postJson("/api/super-admin/admins/revoke", { userId: a.userId });
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchAdmins();
        return { ok: true, message: `Access revoked for ${a.email}.` };
      },
    });
  };

  // ---- Content moderation -----------------------------------------------

  const openUnflag = (item: ContentItem) => {
    actionDialog.open({
      title: "Remove flag",
      confirmLabel: "Unflag",
      summary: [{ label: "Item", value: item.topic || item.subject || "(untitled)" }],
      run: async () => {
        setActionLoading(item.id);
        const result = await postJson("/api/super-admin/content/flag", { type: contentType, id: item.id, flagged: false });
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchContent();
        return { ok: true, message: "Flag removed." };
      },
    });
  };

  const openFlag = (item: ContentItem) => {
    actionDialog.open({
      title: "Flag content",
      tone: "danger",
      confirmLabel: "Flag",
      summary: [{ label: "Item", value: item.topic || item.subject || "(untitled)" }, { label: "Owner", value: item.userEmail }],
      fields: [{ kind: "reason" }],
      run: async (values) => {
        setActionLoading(item.id);
        const result = await postJson("/api/super-admin/content/flag", { type: contentType, id: item.id, flagged: true, reason: values.reason });
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchContent();
        return { ok: true, message: "Content flagged." };
      },
    });
  };

  const openDeleteContent = (item: ContentItem) => {
    actionDialog.open({
      title: "Delete content",
      tone: "danger",
      description: "Hidden from the user and removed from this list.",
      confirmLabel: "Delete",
      summary: [{ label: "Item", value: item.topic || item.subject || "(untitled)" }],
      run: async () => {
        setActionLoading(item.id);
        const result = await postJson(`/api/super-admin/content/${contentType}/${item.id}`, undefined, "DELETE");
        setActionLoading(null);
        if (!result.ok) return result;
        await fetchContent();
        return { ok: true, message: "Content deleted." };
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium" style={{ color: INK_MUTED }}>
          Loading console…
        </p>
      </div>
    );
  }

  return (
    <AdminShell active={tab} onNavigate={setTab} role={role} email={email} pendingCount={pending.length}>
      {tab === "overview" && stats && (
        <section>
          <SectionHeader title="Business at a glance" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Users" value={stats.totalUsers} />
            <StatCard label="Free Plan" value={stats.freeUsers} />
            <StatCard label="Pro Plan" value={stats.proUsers} tone="positive" />
            <StatCard label="Total Schools" value={stats.totalSchools} />
            <StatCard label="Pending Registrations" value={stats.pendingSchools} tone={stats.pendingSchools > 0 ? "warning" : "default"} />
            <StatCard label="Generations (All Time)" value={stats.totalGenerationsToday} tone="positive" />
          </div>
          <AnalyticsPanel />
        </section>
      )}

      {tab === "pending" && (
        <section>
          <SectionHeader title="Pending School Registrations" description="New school signups awaiting approval." />
          {pending.length === 0 ? (
            <EmptyState title="No pending registrations" description="New school signups will show up here." />
          ) : (
            <div className="space-y-2">
              {pending.map((reg) => (
                <AdminCard key={reg.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold" style={{ color: INK }}>{reg.school_name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: INK_MUTED }}>
                      <span>@{reg.email_domain}</span>
                      <Badge tone="accent">{reg.plan_selected}</Badge>
                      <span>{reg.num_teachers} teachers</span>
                      <span className="break-all">{reg.admin_email}</span>
                      <span>{formatAdminDate(reg.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <AdminButton tone="primary" size="sm" loading={actionLoading === reg.id} onClick={() => openApprove(reg)}>
                      Approve
                    </AdminButton>
                    <AdminButton tone="danger" size="sm" loading={actionLoading === reg.id} onClick={() => openReject(reg)}>
                      Reject
                    </AdminButton>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "schools" && (
        <section>
          <SectionHeader title="All Schools" />
          {schools.length === 0 ? (
            <EmptyState title="No schools registered yet" />
          ) : (
            <div className="space-y-2">
              {schools.map((s) => (
                <AdminCard key={s.id} tone={s.status === "inactive" ? "danger" : "default"}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold" style={{ color: INK }}>{s.school_name}</p>
                        <Badge tone={s.status === "inactive" ? "danger" : "positive"}>
                          {s.status === "inactive" ? "Inactive" : "Active"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: INK_MUTED }}>
                        <span>@{s.email_domain}</span>
                        <Badge tone="accent">{formatPlanLabel(s.plan_type)}</Badge>
                        <span>{s.active_teachers}/{s.max_teachers >= 999 ? "∞" : s.max_teachers} teachers</span>
                        <span>{formatAdminDate(s.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton tone="secondary" size="sm" onClick={() => void toggleSchoolExpanded(s.id)}>
                        {expandedSchoolId === s.id ? "Hide Teachers" : "Teachers"}
                      </AdminButton>
                      {s.status === "inactive" ? (
                        <AdminButton tone="primary" size="sm" loading={actionLoading === s.id} onClick={() => openReactivate(s)}>
                          Reactivate
                        </AdminButton>
                      ) : (
                        <AdminButton tone="danger" size="sm" loading={actionLoading === s.id} onClick={() => openDeactivate(s)}>
                          Deactivate
                        </AdminButton>
                      )}
                    </div>
                  </div>

                  {expandedSchoolId === s.id && (
                    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                      {schoolDetailLoading ? (
                        <p className="text-sm" style={{ color: INK_MUTED }}>Loading…</p>
                      ) : schoolTeachers.length === 0 ? (
                        <p className="text-sm" style={{ color: INK_MUTED }}>No teachers yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {schoolTeachers.map((t) => (
                            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--canvas)" }}>
                              <div>
                                <span className="break-all font-medium" style={{ color: INK }}>{t.email}</span>
                                <span className="ml-2 text-xs" style={{ color: INK_MUTED }}>
                                  {t.role === "admin" ? "School Admin" : t.role === "hod" ? "HOD" : "Teacher"}
                                  {t.department ? ` · ${t.department}` : ""}
                                </span>
                              </div>
                              {t.role === "admin" ? (
                                <AdminButton tone="danger" size="sm" loading={actionLoading === t.user_id} onClick={() => openRemoveSchoolAdmin(s.id, t)}>
                                  Remove Admin
                                </AdminButton>
                              ) : (
                                <AdminButton tone="secondary" size="sm" loading={actionLoading === t.user_id} onClick={() => void handleAssignSchoolAdmin(s.id, t.user_id)}>
                                  Make Admin
                                </AdminButton>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </AdminCard>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "users" && <UsersPanel />}

      {tab === "admins" && (
        <section className="space-y-6">
          <div>
            <SectionHeader title="Grant Admin Access" />
            <AdminCard>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>
                    Email (must already have a Layah account)
                  </label>
                  <AdminInput type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="teammate@example.com" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold" style={{ color: INK_MUTED }}>Role</label>
                  <AdminSelect value={grantRole} onChange={(e) => setGrantRole(e.target.value as "admin" | "super_admin")}>
                    <option value="admin">Admin (narrower — pick permissions below)</option>
                    <option value="super_admin">Super Admin (full access, including refunds)</option>
                  </AdminSelect>
                </div>
              </div>

              {grantRole === "admin" && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold" style={{ color: INK_MUTED }}>Permissions</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ADMIN_PERMISSIONS.map((permission) => (
                      <CheckField
                        key={permission}
                        label={permission}
                        className={FONT_MONO}
                        checked={grantPermissions.has(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <AdminButton tone="primary" className="mt-4" loading={actionLoading === "grant"} onClick={openGrantAdmin}>
                Grant Access
              </AdminButton>
            </AdminCard>
          </div>

          <div>
            <SectionHeader title={`Current Admins (${admins.length})`} />
            {admins.length === 0 ? (
              <EmptyState title="No admins found" />
            ) : (
              <div className="space-y-2">
                {admins.map((a) => (
                  <AdminCard key={a.userId} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="break-all font-semibold" style={{ color: INK }}>{a.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
                        <Badge tone={a.role === "super_admin" ? "danger" : "accent"}>
                          {a.role === "super_admin" ? "Super Admin" : "Admin"}
                        </Badge>
                        <span>Granted {formatAdminDate(a.grantedAt)}</span>
                      </div>
                      {a.role === "admin" && (
                        <p className={`mt-1 text-xs ${FONT_MONO}`} style={{ color: INK_FAINT }}>
                          {a.permissions.length > 0 ? a.permissions.join(", ") : "No permissions granted yet"}
                        </p>
                      )}
                    </div>
                    <AdminButton tone="danger" size="sm" loading={actionLoading === a.userId} onClick={() => openRevokeAdmin(a)}>
                      Revoke
                    </AdminButton>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "content" && (
        <section>
          <SectionHeader title="Content Moderation" />

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <AdminSelect value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className="w-auto">
              {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
                <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
              ))}
            </AdminSelect>
            <AdminInput
              type="text"
              value={contentSearch}
              onChange={(e) => setContentSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void fetchContent()}
              placeholder="Search subject / topic / grade…"
              className="min-w-[220px] flex-1"
            />
            <CheckField
              label="Flagged only"
              checked={contentFlaggedOnly}
              onChange={(e) => setContentFlaggedOnly(e.target.checked)}
            />
            <AdminButton tone="primary" onClick={() => void fetchContent()}>Search</AdminButton>
          </div>

          {contentLoading ? (
            <EmptyState title="Loading…" />
          ) : contentItems.length === 0 ? (
            <EmptyState title="No content found" />
          ) : (
            <div className="space-y-2">
              {contentItems.map((item) => (
                <AdminCard key={item.id} tone={item.flagged ? "danger" : "default"} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold" style={{ color: INK }}>
                      {item.topic || item.subject || "(untitled)"}
                      {item.flagged && <Badge tone="danger">Flagged</Badge>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: INK_MUTED }}>
                      <span>{item.subject}</span>
                      <span>{item.grade}</span>
                      <span className="break-all">{item.userEmail}</span>
                      <span>{formatAdminDate(item.created_at)}</span>
                    </div>
                    {item.flagged && item.flagged_reason && (
                      <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger-text)" }}>Reason: {item.flagged_reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <AdminButton tone="secondary" size="sm" loading={actionLoading === item.id} onClick={() => (item.flagged ? openUnflag(item) : openFlag(item))}>
                      {item.flagged ? "Unflag" : "Flag"}
                    </AdminButton>
                    <AdminButton tone="danger" size="sm" loading={actionLoading === item.id} onClick={() => openDeleteContent(item)}>
                      Delete
                    </AdminButton>
                  </div>
                </AdminCard>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "billing" && <BillingPanel />}
      {tab === "announcements" && <AnnouncementsPanel />}
    </AdminShell>
  );
}

export function SuperAdminDashboard({ role, email }: { role: "super_admin" | "admin"; email: string }) {
  return (
    <AdminProviders>
      <DashboardBody role={role} email={email} />
    </AdminProviders>
  );
}
