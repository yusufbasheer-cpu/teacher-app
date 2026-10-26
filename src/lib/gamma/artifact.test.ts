import { beforeEach, describe, expect, it, vi } from "vitest";

const download = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServiceRole: () => ({ storage: { from: () => ({ download }) } }),
}));

import { readGammaArtifact } from "./artifact";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";

describe("readGammaArtifact only reads the owner's own folder", () => {
  beforeEach(() => {
    download.mockReset();
    download.mockResolvedValue({ data: new Blob(["PK"]), error: null });
  });

  it("reads the caller's own artifact", async () => {
    await expect(readGammaArtifact(A, `${A}/gen-1.pptx`)).resolves.toBeInstanceOf(Buffer);
    expect(download).toHaveBeenCalledWith(`${A}/gen-1.pptx`);
  });

  it.each([
    ["another user's folder", `${B}/gen-1.pptx`],
    ["a traversal out of the folder", `${A}/../${B}/gen-1.pptx`],
    ["a prefix-only match", `${A}x/gen-1.pptx`],
  ])("refuses %s without touching storage", async (_label, path) => {
    await expect(readGammaArtifact(A, path)).rejects.toThrow("unavailable");
    expect(download).not.toHaveBeenCalled();
  });

  it("refuses when there is no user", async () => {
    await expect(readGammaArtifact("", `${A}/gen-1.pptx`)).rejects.toThrow("unavailable");
  });
});
