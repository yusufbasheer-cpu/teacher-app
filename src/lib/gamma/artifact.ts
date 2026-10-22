import { getSupabaseServiceRole } from "@/lib/supabase-admin";
import { GammaError } from "./config";

export const GAMMA_ARTIFACT_BUCKET = "gamma-pptx-artifacts";

function db() {
  const client = getSupabaseServiceRole();
  if (!client) throw new GammaError("store_unavailable", "Gamma artifact storage is unavailable.");
  return client;
}

export function artifactPath(userId: string, generationId: string): string {
  return `${userId}/${generationId}.pptx`;
}

export async function storeGammaArtifact(userId: string, generationId: string, buffer: Buffer): Promise<string> {
  const path = artifactPath(userId, generationId);
  const { error } = await db().storage.from(GAMMA_ARTIFACT_BUCKET).upload(path, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    upsert: true,
  });
  if (error) throw new GammaError("store_unavailable", `Gamma artifact upload failed: ${error.message.slice(0, 120)}`);
  return path;
}

export async function readGammaArtifact(path: string): Promise<Buffer> {
  const { data, error } = await db().storage.from(GAMMA_ARTIFACT_BUCKET).download(path);
  if (error || !data) throw new GammaError("store_unavailable", "Stored Gamma artifact is unavailable.");
  return Buffer.from(await data.arrayBuffer());
}

export async function createGammaArtifactUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await db().storage.from(GAMMA_ARTIFACT_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) throw new GammaError("store_unavailable", "Could not authorize the Gamma artifact download.");
  return data.signedUrl;
}
