import { randomUUID } from "node:crypto";
import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { GammaError } from "./config";
import type { SlideSnapshot } from "./payload";

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
  sourceSnapshot?: SlideSnapshot[] | null;
  artifactPath?: string | null;
  validationReport?: Record<string, unknown> | null;
  requestMetadata?: Record<string, unknown> | null;
  themeId?: string | null;
  imageSource?: string | null;
  imageStyle?: string | null;
  durationMs?: number | null;
  exportMetadata?: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
};

export type GammaRowPatch = Partial<
  Pick<GammaRow, "status" | "generationId" | "creditsDeducted" | "creditsRemaining" | "errorCode" | "delivered" | "artifactPath" | "validationReport" | "requestMetadata" | "themeId" | "imageSource" | "imageStyle" | "durationMs" | "exportMetadata">
>;

/** Persistent ledger. Every method must reject (never silently succeed) when the backing store is unavailable. */
export interface GammaStore {
  /** Atomically inserts a 'submitting' row; returns null if the user already has an active generation. */
  insertSubmitting(input: { userId: string; requestHash: string; requestedSlides: number; sourceSnapshot?: SlideSnapshot[]; now: number }): Promise<GammaRow | null>;
  update(id: string, patch: GammaRowPatch, now: number): Promise<void>;
  findActiveForUser(userId: string): Promise<GammaRow | null>;
  /** Completed generation we paid for but never delivered (e.g. download rejected): resumable without new spend. */
  findUndelivered(userId: string, requestHash: string, sinceMs: number): Promise<GammaRow | null>;
  findReusableArtifact?(input: { userId: string; requestHash: string; themeId?: string | null; imageSource?: string | null; imageStyle?: string | null }): Promise<GammaRow | null>;
  countStartedSince(userId: string, sinceMs: number): Promise<number>;
  /** All rows created since `sinceMs` (credit accounting). */
  rowsSince(sinceMs: number): Promise<Pick<GammaRow, "status" | "creditsDeducted" | "createdAt">[]>;
}

export class InMemoryGammaStore implements GammaStore {
  rows: GammaRow[] = [];

  async insertSubmitting(i: { userId: string; requestHash: string; requestedSlides: number; sourceSnapshot?: SlideSnapshot[]; now: number }) {
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
      sourceSnapshot: i.sourceSnapshot ?? null,
      artifactPath: null,
      validationReport: null,
      requestMetadata: null,
      themeId: null,
      imageSource: null,
      imageStyle: null,
      durationMs: null,
      exportMetadata: null,
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
  async findReusableArtifact(i: { userId: string; requestHash: string; themeId?: string | null; imageSource?: string | null; imageStyle?: string | null }) {
    const r = [...this.rows].reverse().find((x) => x.userId === i.userId && x.requestHash === i.requestHash && x.status === "completed" && x.artifactPath && x.validationReport && x.validationReport.verdict === "passed" && (x.themeId ?? null) === (i.themeId ?? null) && (x.imageSource ?? null) === (i.imageSource ?? null) && (x.imageStyle ?? null) === (i.imageStyle ?? null));
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
  source_snapshot: SlideSnapshot[] | null;
  artifact_path: string | null;
  validation_report: Record<string, unknown> | null;
  request_metadata: Record<string, unknown> | null;
  theme_id: string | null;
  image_source: string | null;
  image_style: string | null;
  duration_ms: number | null;
  export_metadata: Record<string, unknown> | null;
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
  sourceSnapshot: r.source_snapshot ?? null,
  artifactPath: r.artifact_path ?? null,
  validationReport: r.validation_report ?? null,
  requestMetadata: r.request_metadata ?? null,
  themeId: r.theme_id ?? null,
  imageSource: r.image_source ?? null,
  imageStyle: r.image_style ?? null,
  durationMs: r.duration_ms ?? null,
  exportMetadata: r.export_metadata ?? null,
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

  async insertSubmitting(i: { userId: string; requestHash: string; requestedSlides: number; sourceSnapshot?: SlideSnapshot[]; now: number }) {
    const { data, error } = await this.db()
      .from("gamma_generations")
      .insert({ user_id: i.userId, request_hash: i.requestHash, status: "submitting", requested_slides: i.requestedSlides, source_snapshot: i.sourceSnapshot ?? null, created_at: iso(i.now), updated_at: iso(i.now) })
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
    if (patch.artifactPath !== undefined) body.artifact_path = patch.artifactPath;
    if (patch.validationReport !== undefined) body.validation_report = patch.validationReport;
    if (patch.requestMetadata !== undefined) body.request_metadata = patch.requestMetadata;
    if (patch.themeId !== undefined) body.theme_id = patch.themeId;
    if (patch.imageSource !== undefined) body.image_source = patch.imageSource;
    if (patch.imageStyle !== undefined) body.image_style = patch.imageStyle;
    if (patch.durationMs !== undefined) body.duration_ms = patch.durationMs;
    if (patch.exportMetadata !== undefined) body.export_metadata = patch.exportMetadata;
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
  async findReusableArtifact(i: { userId: string; requestHash: string; themeId?: string | null; imageSource?: string | null; imageStyle?: string | null }) {
    const { data, error } = await this.db().from("gamma_generations").select("*").eq("user_id", i.userId).eq("request_hash", i.requestHash).eq("status", "completed").not("artifact_path", "is", null).order("created_at", { ascending: false }).limit(10);
    if (error) this.fail("artifact lookup", error);
    const row = (data ?? []).map((x) => fromDb(x as DbRow)).find((x) => x.validationReport?.verdict === "passed" && (x.themeId ?? null) === (i.themeId ?? null) && (x.imageSource ?? null) === (i.imageSource ?? null) && (x.imageStyle ?? null) === (i.imageStyle ?? null));
    return row ?? null;
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
