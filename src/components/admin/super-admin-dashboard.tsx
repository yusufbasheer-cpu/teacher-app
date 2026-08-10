"use client";

import { useCallback, useEffect, useState } from "react";

const NAVY = "#241A12";
const TEAL = "#0E9484";
const MUTED = "#6B5D4F";

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
};

type UserRow = {
  id: string;
  email: string;
  createdAt: string;
  planType: string;
  generationsUsed: number;
  generationsLimit: number;
};

type Tab = "overview" | "pending" | "schools" | "users";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatPlan(plan: string) {
  return plan.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border bg-[#FAF6EF] p-5 shadow-sm"
      style={{ borderColor: "rgba(14, 148, 132,0.25)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent ? TEAL : NAVY }}>
        {value}
      </p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2 text-sm font-semibold transition"
      style={{
        background: active ? NAVY : "transparent",
        color: active ? "#fff" : MUTED,
        border: active ? "none" : "1px solid #E3D9C8",
      }}
    >
      {label}
    </button>
  );
}

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingReg[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/super-admin/stats");
    if (res.ok) {
      const data = (await res.json()) as Stats;
      setStats(data);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    const res = await fetch("/api/super-admin/pending");
    if (res.ok) {
      const data = (await res.json()) as { registrations: PendingReg[] };
      setPending(data.registrations);
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    const res = await fetch("/api/super-admin/schools");
    if (res.ok) {
      const data = (await res.json()) as { schools: School[] };
      setSchools(data.schools);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/super-admin/users");
    if (res.ok) {
      const data = (await res.json()) as { users: UserRow[] };
      setUsers(data.users);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchPending(), fetchSchools(), fetchUsers()]);
      setLoading(false);
    };
    void load();
  }, [fetchStats, fetchPending, fetchSchools, fetchUsers]);

  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this school registration? This will create the school account and send an activation email.")) return;
    setActionLoading(id);
    setError(null);
    const res = await fetch("/api/super-admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Approval failed");
    } else {
      await Promise.all([fetchPending(), fetchSchools(), fetchStats()]);
    }
    setActionLoading(null);
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject this school registration? A rejection email will be sent.")) return;
    setActionLoading(id);
    setError(null);
    const res = await fetch("/api/super-admin/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: id }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Rejection failed");
    } else {
      await Promise.all([fetchPending(), fetchStats()]);
    }
    setActionLoading(null);
  };

  const handleDeactivate = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`Deactivate ${schoolName}? This will remove the school and all teacher memberships.`)) return;
    setActionLoading(schoolId);
    setError(null);
    const res = await fetch("/api/super-admin/deactivate-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Deactivation failed");
    } else {
      await Promise.all([fetchSchools(), fetchStats()]);
    }
    setActionLoading(null);
  };

  const handleChangePlan = async (userId: string, planType: string) => {
    setActionLoading(userId);
    setError(null);
    const res = await fetch("/api/super-admin/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, planType }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Plan change failed");
    } else {
      await fetchUsers();
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border bg-[#FAF6EF]" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
        <p className="text-sm font-medium" style={{ color: MUTED }}>Loading super admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <header
        className="rounded-2xl p-6 sm:p-8"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #3a2a1e 55%, rgba(14, 148, 132,0.15) 100%)`, color: "white" }}
      >
        <p
          className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ borderColor: "#f87171", color: "#f87171", background: "rgba(248,113,113,0.12)" }}
        >
          Super Admin
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Layah Control Panel</h1>
        <p className="mt-2 text-sm text-white/70">Manage schools, users, and registrations</p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "overview"} label="Overview" onClick={() => setTab("overview")} />
        <TabButton
          active={tab === "pending"}
          label={`Pending Schools (${pending.length})`}
          onClick={() => setTab("pending")}
        />
        <TabButton active={tab === "schools"} label="All Schools" onClick={() => setTab("schools")} />
        <TabButton active={tab === "users"} label="All Users" onClick={() => setTab("users")} />
      </div>

      {tab === "overview" && stats && (
        <section>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Registered Users" value={stats.totalUsers} />
            <StatCard label="Free Plan Users" value={stats.freeUsers} />
            <StatCard label="Pro Plan Users" value={stats.proUsers} />
            <StatCard label="Total Schools" value={stats.totalSchools} accent />
            <StatCard label="Pending Registrations" value={stats.pendingSchools} />
            <StatCard label="Total Generations (All Time)" value={stats.totalGenerationsToday} accent />
          </div>
        </section>
      )}

      {tab === "pending" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
            Pending School Registrations
          </h2>
          {pending.length === 0 ? (
            <div className="rounded-2xl border bg-[#FAF6EF] p-6 text-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)", color: MUTED }}>
              No pending registrations.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border bg-[#FAF6EF] shadow-sm md:block" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50" style={{ borderColor: "#E3D9C8" }}>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>School Name</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Email Domain</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Plan</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Teachers</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Admin Email</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Date</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((reg) => (
                      <tr key={reg.id} className="border-b last:border-b-0" style={{ borderColor: "#E3D9C8" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: NAVY }}>{reg.school_name}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>@{reg.email_domain}</td>
                        <td className="px-4 py-3" style={{ color: TEAL }}>{reg.plan_selected}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{reg.num_teachers}</td>
                        <td className="px-4 py-3 break-all" style={{ color: MUTED }}>{reg.admin_email}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{formatDate(reg.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={actionLoading === reg.id}
                              onClick={() => void handleApprove(reg.id)}
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              style={{ background: TEAL }}
                            >
                              {actionLoading === reg.id ? "..." : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading === reg.id}
                              onClick={() => void handleReject(reg.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {actionLoading === reg.id ? "..." : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {pending.map((reg) => (
                  <div key={reg.id} className="rounded-2xl border bg-[#FAF6EF] p-4 shadow-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                    <p className="font-semibold" style={{ color: NAVY }}>{reg.school_name}</p>
                    <p className="mt-1 text-sm" style={{ color: MUTED }}>@{reg.email_domain}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: MUTED }}>
                      <span style={{ color: TEAL }}>{reg.plan_selected}</span>
                      <span>{reg.num_teachers}</span>
                      <span>{formatDate(reg.created_at)}</span>
                    </div>
                    <p className="mt-1 break-all text-xs" style={{ color: MUTED }}>{reg.admin_email}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={actionLoading === reg.id}
                        onClick={() => void handleApprove(reg.id)}
                        className="flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: TEAL }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === reg.id}
                        onClick={() => void handleReject(reg.id)}
                        className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "schools" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>All Schools</h2>
          {schools.length === 0 ? (
            <div className="rounded-2xl border bg-[#FAF6EF] p-6 text-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)", color: MUTED }}>
              No schools registered yet.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border bg-[#FAF6EF] shadow-sm md:block" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50" style={{ borderColor: "#E3D9C8" }}>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>School Name</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Domain</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Plan</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Teachers</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Max</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Registered</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((s) => (
                      <tr key={s.id} className="border-b last:border-b-0" style={{ borderColor: "#E3D9C8" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: NAVY }}>{s.school_name}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>@{s.email_domain}</td>
                        <td className="px-4 py-3" style={{ color: TEAL }}>{formatPlan(s.plan_type)}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{s.active_teachers}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{s.max_teachers >= 999 ? "∞" : s.max_teachers}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{formatDate(s.created_at)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={actionLoading === s.id}
                            onClick={() => void handleDeactivate(s.id, s.school_name)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {actionLoading === s.id ? "..." : "Deactivate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {schools.map((s) => (
                  <div key={s.id} className="rounded-2xl border bg-[#FAF6EF] p-4 shadow-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                    <p className="font-semibold" style={{ color: NAVY }}>{s.school_name}</p>
                    <p className="mt-1 text-sm" style={{ color: MUTED }}>@{s.email_domain}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: MUTED }}>
                      <span style={{ color: TEAL }}>{formatPlan(s.plan_type)}</span>
                      <span>{s.active_teachers}/{s.max_teachers >= 999 ? "∞" : s.max_teachers} teachers</span>
                      <span>{formatDate(s.created_at)}</span>
                    </div>
                    <button
                      type="button"
                      disabled={actionLoading === s.id}
                      onClick={() => void handleDeactivate(s.id, s.school_name)}
                      className="mt-3 w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "users" && (
        <section>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: NAVY }}>
            All Users ({users.length})
          </h2>
          {users.length === 0 ? (
            <div className="rounded-2xl border bg-[#FAF6EF] p-6 text-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)", color: MUTED }}>
              No users found.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border bg-[#FAF6EF] shadow-sm md:block" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-stone-50" style={{ borderColor: "#E3D9C8" }}>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Email</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Plan</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Generations</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Joined</th>
                      <th className="px-4 py-3 font-semibold" style={{ color: NAVY }}>Change Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b last:border-b-0" style={{ borderColor: "#E3D9C8" }}>
                        <td className="px-4 py-3 break-all font-medium" style={{ color: NAVY }}>{u.email}</td>
                        <td className="px-4 py-3" style={{ color: TEAL }}>{formatPlan(u.planType)}</td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>
                          {u.generationsUsed} / {u.generationsLimit === -1 ? "∞" : u.generationsLimit}
                        </td>
                        <td className="px-4 py-3" style={{ color: MUTED }}>{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.planType}
                            disabled={actionLoading === u.id}
                            onChange={(e) => void handleChangePlan(u.id, e.target.value)}
                            className="rounded-lg border bg-[#FAF6EF] px-2 py-1 text-xs font-medium outline-none"
                            style={{ borderColor: "#D9CCB8", color: NAVY }}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="pro_plus">Pro Plus</option>
                            <option value="school_starter">School Starter</option>
                            <option value="school_pro">School Pro</option>
                            <option value="school_enterprise">School Enterprise</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {users.map((u) => (
                  <div key={u.id} className="rounded-2xl border bg-[#FAF6EF] p-4 shadow-sm" style={{ borderColor: "rgba(14, 148, 132,0.25)" }}>
                    <p className="break-all font-semibold" style={{ color: NAVY }}>{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: MUTED }}>
                      <span style={{ color: TEAL }}>{formatPlan(u.planType)}</span>
                      <span>{u.generationsUsed}/{u.generationsLimit === -1 ? "∞" : u.generationsLimit} gen</span>
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                    <select
                      value={u.planType}
                      disabled={actionLoading === u.id}
                      onChange={(e) => void handleChangePlan(u.id, e.target.value)}
                      className="mt-3 w-full rounded-lg border bg-[#FAF6EF] px-3 py-2 text-sm font-medium outline-none"
                      style={{ borderColor: "#D9CCB8", color: NAVY }}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="pro_plus">Pro Plus</option>
                      <option value="school_starter">School Starter</option>
                      <option value="school_pro">School Pro</option>
                      <option value="school_enterprise">School Enterprise</option>
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
