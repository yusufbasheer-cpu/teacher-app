import { randomUUID } from "node:crypto";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { GammaError } from "./config";

export type GammaStatus = "submitting" | "pending" | "unknown" | "completed" | "failed" | "abandoned";
export const ACTIVE_STATUSES: readonly GammaStatus[] = ["submitting", "pending", "unknown"];

export type GammaRow = {
  id: string;
  userId: string;
  requestHash: string;
  status: GammaStatus;
  generationId: string | null;
  requestedSlides: number;
  creditsDeducted: number | null;
  creditsRemaining: number | null;
  errorCode: string | null;
  delivered: boolean;
  createdAt: number;
  updatedAt: number;
};

export type GammaRowPatch = Partial<
  Pick<GammaRow, "status" | "generationId" | "creditsDeducted" | "creditsRemaining" | "errorCode" | "delivered">
>;

/** Persistent ledger. Every method must reject (never silently succeed) when the backing store is unavailable. */
export interface GammaStore {
  /** Atomically inserts a 'submitting' row; returns null if the user already has an active generation. */
  insertSubmitting(input: { userId: string; requestHash: string; requestedSlides: number; now: number }): Promise<GammaRow | null>;
  update(id: string, patch: GammaRowPatch, now: number): Promise<void>;
  findActiveForUser(userId: string): Promise<GammaRow | null>;
  /** Completed generation we paid for but never delivered (e.g. download rejected): resumable without new spend. */
  findUndelivered(userId: string, requestHash: string, sinceMs: number): Promise<GammaRow | null>;
  countStartedSince(userId: string, sinceMs: number): Promise<number>;
  /** All rows created since `sinceMs` (credit accounting). */
  rowsSince(sinceMs: number): Promise<Pick<GammaRow, "status" | "creditsDeducted" | "createdAt">[]>;
}

export class InMemoryGammaStore implements GammaStore {
  rows: GammaRow[] = [];

  async insertSubmitting(i: { userId: string; requestHash: string; requestedSlides: number; now: number }) {
    if (this.rows.some((r) => r.userId === i.userId && ACTIVE_STATUSES.includes(r.status))) return null;
    const row: GammaRow = {
      id: randomUUID(),
      userId: i.userId,
      requestHash: i.requestHash,
      status: "submitting",
      generationId: null,
      requestedSlides: i.requestedSlides,
      creditsDeducted: null,
      creditsRemaining: null,
      errorCode: null,
      delivered: false,
      createdAt: i.now,
      updatedAt: i.now,
    };
    this.rows.push(row);
    return { ...row };
  }
  async update(id: string, patch: GammaRowPatch, now: number) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) throw new Error("gamma row not found");
    Object.assign(r, patch, { updatedAt: now });
  }
  async findActiveForUser(userId: string) {
    const r = this.rows.find((x) => x.userId === userId && ACTIVE_STATUSES.includes(x.status));
    return r ? { ...r } : null;
  }
  async findUndelivered(userId: string, requestHash: string, sinceMs: number) {
    const r = [...this.rows]
      .reverse()
      .find((x) => x.userId === userId && x.requestHash === requestHash && x.status === "completed" && !x.delivered && x.generationId && x.createdAt >= sinceMs);
    return r ? { ...r } : null;
  }
  async countStartedSince(userId: string, sinceMs: number) {
    return this.rows.filter((r) => r.userId === userId && r.createdAt >= sinceMs).length;
  }
  async rowsSince(sinceMs: number) {
    return this.rows.filter((r) => r.createdAt >= sinceMs).map((r) => ({ status: r.status, creditsDeducted: r.creditsDeducted, createdAt: r.createdAt }));
  }
}

type DbRow = {
  id: string;
  user_id: string;
  request_hash: string;
  status: GammaStatus;
  generation_id: string | null;
  requested_slides: number;
  credits_deducted: number | null;
  credits_remaining: number | null;
  error_code: string | null;
  delivered: boolean;
  created_at: string;
  updated_at: string;
};
const numOrNull = (v: number | null) => (v === null ? null : Number(v));
const fromDb = (r: DbRow): GammaRow => ({
  id: r.id,
  userId: r.user_id,
  requestHash: r.request_hash,
  status: r.status,
  generationId: r.generation_id,
  requestedSlides: r.requested_slides,
  creditsDeducted: numOrNull(r.credits_deducted),
  creditsRemaining: numOrNull(r.credits_remaining),
  errorCode: r.error_code,
  delivered: r.delivered,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
});
const iso = (ms: number) => new Date(ms).toISOString();

export class SupabaseGammaStore implements GammaStore {
  private db() {
    const c = getSupabaseServiceRole();
    if (!c) throw new GammaError("store_unavailable", "Gamma ledger unavailable (Supabase service role not configured).");
    return c;
  }
  private fail(what: string, err: { message?: string } | null): never {
    throw new GammaError(
      "store_unavailable",
      `Gamma ledger ${what} failed${err?.message ? `: ${err.message.slice(0, 120)}` : ""}. Is migration 20261022120000_gamma_generations applied?`,
    );
  }

  async insertSubmitting(i: { userId: string; requestHash: string; requestedSlides: number; now: number }) {
    const { data, error } = await this.db()
      .from("gamma_generations")
      .insert({ user_id: i.userId, request_hash: i.requestHash, status: "submitting", requested_slides: i.requestedSlides, created_at: iso(i.now), updated_at: iso(i.now) })
      .select("*")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return null; // one-active-per-user unique index
      this.fail("insert", error);
    }
    return fromDb(data as DbRow);
  }
  async update(id: string, patch: GammaRowPatch, now: number) {
    const body: Record<string, unknown> = { updated_at: iso(now) };
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.generationId !== undefined) body.generation_id = patch.generationId;
    if (patch.creditsDeducted !== undefined) body.credits_deducted = patch.creditsDeducted;
    if (patch.creditsRemaining !== undefined) body.credits_remaining = patch.creditsRemaining;
    if (patch.errorCode !== undefined) body.error_code = patch.errorCode;
    if (patch.delivered !== undefined) body.delivered = patch.delivered;
    const { error } = await this.db().from("gamma_generations").update(body).eq("id", id);
    if (error) this.fail("update", error);
  }
  async findActiveForUser(userId: string) {
    const { data, error } = await this.db().from("gamma_generations").select("*").eq("user_id", userId).in("status", [...ACTIVE_STATUSES]).limit(1);
    if (error) this.fail("lookup", error);
    return data?.[0] ? fromDb(data[0] as DbRow) : null;
  }
  async findUndelivered(userId: string, requestHash: string, sinceMs: number) {
    const { data, error } = await this.db()
      .from("gamma_generations")
      .select("*")
      .eq("user_id", userId)
      .eq("request_hash", requestHash)
      .eq("status", "completed")
      .eq("delivered", false)
      .not("generation_id", "is", null)
      .gte("created_at", iso(sinceMs))
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) this.fail("lookup", error);
    return data?.[0] ? fromDb(data[0] as DbRow) : null;
  }
  async countStartedSince(userId: string, sinceMs: number) {
    const { count, error } = await this.db().from("gamma_generations").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", iso(sinceMs));
    if (error) this.fail("count", error);
    return count ?? 0;
  }
  async rowsSince(sinceMs: number) {
    const { data, error } = await this.db().from("gamma_generations").select("status,credits_deducted,created_at").gte("created_at", iso(sinceMs)).limit(10_000);
    if (error) this.fail("spend query", error);
    return (data ?? []).map((r: { status: GammaStatus; credits_deducted: number | null; created_at: string }) => ({ status: r.status, creditsDeducted: numOrNull(r.credits_deducted), createdAt: Date.parse(r.created_at) }));
  }
}

export function getDefaultGammaStore(): GammaStore {
  return new SupabaseGammaStore();
}
