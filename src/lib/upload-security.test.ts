import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import JSZip from "jszip";
import {
  sniffFileSignature,
  isUnsafeZipEntryName,
  inspectZipSafety,
  assertPixelBudget,
  checkImageUrlAllowed,
  isPrivateOrReservedIp,
  assertResolvesToPublicAddress,
  scanBufferForMalware,
  type ZipSafetyLimits,
} from "./upload-security";

/* ────────────────────────────────────────────────────────────────────────
 * Magic-byte sniffing
 * ──────────────────────────────────────────────────────────────────────── */

describe("sniffFileSignature", () => {
  it("recognizes a real PDF header", () => {
    expect(sniffFileSignature(Buffer.from("%PDF-1.4\n%rest of file"))).toBe("pdf");
  });

  it("recognizes a real PNG signature", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffFileSignature(buf)).toBe("png");
  });

  it("recognizes a real JPEG signature", () => {
    expect(sniffFileSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("jpeg");
  });

  it("recognizes a ZIP-family signature (pptx/docx/xlsx are all zips)", () => {
    expect(sniffFileSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe("zip");
  });

  it("rejects a renamed Windows executable (MZ header) regardless of claimed extension", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // "MZ..."
    expect(sniffFileSignature(exe)).toBeNull();
  });

  it("rejects a renamed ELF executable", () => {
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]); // \x7fELF
    expect(sniffFileSignature(elf)).toBeNull();
  });

  it("rejects plain text pretending to be any known format", () => {
    expect(sniffFileSignature(Buffer.from("just some plain text, not a real file"))).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(sniffFileSignature(Buffer.alloc(0))).toBeNull();
  });

  it("is not fooled by a file extension or claimed MIME type — it never looks at either", () => {
    // A PNG's actual bytes, regardless of what a caller might have named it or
    // what Content-Type a browser sent alongside it.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    expect(sniffFileSignature(pngBytes)).toBe("png");
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Zip entry-name safety (path traversal / zip-slip)
 * ──────────────────────────────────────────────────────────────────────── */

describe("isUnsafeZipEntryName", () => {
  it("accepts a normal relative office-document entry path", () => {
    expect(isUnsafeZipEntryName("ppt/slides/slide1.xml")).toBe(false);
    expect(isUnsafeZipEntryName("[Content_Types].xml")).toBe(false);
    expect(isUnsafeZipEntryName("docProps/core.xml")).toBe(false);
  });

  it("rejects parent-directory traversal", () => {
    expect(isUnsafeZipEntryName("../../../etc/passwd")).toBe(true);
    expect(isUnsafeZipEntryName("ppt/media/../../../etc/passwd")).toBe(true);
  });

  it("rejects an absolute path", () => {
    expect(isUnsafeZipEntryName("/etc/passwd")).toBe(true);
  });

  it("rejects a Windows drive-letter absolute path", () => {
    expect(isUnsafeZipEntryName("C:\\Windows\\System32\\evil.dll")).toBe(true);
  });

  it("rejects backslash path separators", () => {
    expect(isUnsafeZipEntryName("ppt\\media\\image1.png")).toBe(true);
  });

  it("rejects a NUL byte in the entry name", () => {
    expect(isUnsafeZipEntryName("innocuous.txt\u0000.exe")).toBe(true);
  });

  it("rejects an empty or excessively long name", () => {
    expect(isUnsafeZipEntryName("")).toBe(true);
    expect(isUnsafeZipEntryName("a".repeat(600))).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Zip archive safety (entry count / decompression-bomb caps)
 * ──────────────────────────────────────────────────────────────────────── */

describe("inspectZipSafety", () => {
  async function buildZip(entries: Record<string, string>): Promise<JSZip> {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(entries)) {
      zip.file(name, content);
    }
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    return JSZip.loadAsync(buf);
  }

  it("accepts a small, well-formed archive under default limits", async () => {
    const zip = await buildZip({ "a.xml": "<a/>", "b.xml": "<b/>" });
    expect(inspectZipSafety(zip)).toEqual({ ok: true });
  });

  it("rejects an archive whose central directory carries an unsafe raw entry name", async () => {
    // JSZip's own `.file()` writer already normalizes ".." segments for
    // archives it authors itself, so this simulates what its *reader* would
    // hand back from a hand-crafted, adversarial archive: a raw, unresolved
    // name sitting directly in the parsed entry table. This is the exact
    // shape `inspectZipSafety` reads (`.dir`, `.name`, `._data.uncompressedSize`).
    const zip = await buildZip({}); // real JSZip instance, just empty
    const maliciousName = "../../etc/passwd";
    zip.files[maliciousName] = {
      name: maliciousName,
      dir: false,
      _data: { uncompressedSize: 5 },
    } as unknown as JSZip.JSZipObject;
    const result = inspectZipSafety(zip);
    expect(result.ok).toBe(false);
  });

  it("rejects an archive exceeding the configured entry-count limit", async () => {
    const zip = await buildZip({ "a.xml": "x", "b.xml": "y", "c.xml": "z" });
    const limits: ZipSafetyLimits = {
      maxEntries: 2,
      maxEntryUncompressedBytes: 10_000,
      maxTotalUncompressedBytes: 10_000,
    };
    const result = inspectZipSafety(zip, limits);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining("too many entries") });
  });

  it("rejects a single entry whose declared uncompressed size exceeds the per-entry cap (decompression bomb)", async () => {
    // A real, small, highly-compressible payload — the cap is what makes this
    // a "bomb" relative to the limit, not the actual bytes on disk.
    const zip = await buildZip({ "bomb.txt": "A".repeat(50_000) });
    const limits: ZipSafetyLimits = {
      maxEntries: 100,
      maxEntryUncompressedBytes: 1_000, // far below the real 50,000-byte payload
      maxTotalUncompressedBytes: 10_000_000,
    };
    const result = inspectZipSafety(zip, limits);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/exceeding the 1000-byte per-file limit/);
  });

  it("rejects when the SUM of declared sizes exceeds the total cap even if no single entry does", async () => {
    const zip = await buildZip({
      "one.txt": "A".repeat(6_000),
      "two.txt": "B".repeat(6_000),
    });
    const limits: ZipSafetyLimits = {
      maxEntries: 100,
      maxEntryUncompressedBytes: 10_000,
      maxTotalUncompressedBytes: 10_000, // 6000 + 6000 > 10000
    };
    const result = inspectZipSafety(zip, limits);
    expect(result.ok).toBe(false);
  });

  it("does not decompress anything to perform its checks (declared-size only)", async () => {
    // A large-but-within-limits payload should pass instantly; if this test
    // were slow it would indicate the guard is actually inflating content.
    const zip = await buildZip({ "big.txt": "Z".repeat(500_000) });
    const start = Date.now();
    const result = inspectZipSafety(zip, {
      maxEntries: 10,
      maxEntryUncompressedBytes: 1_000_000,
      maxTotalUncompressedBytes: 1_000_000,
    });
    expect(result).toEqual({ ok: true });
    expect(Date.now() - start).toBeLessThan(200);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Image decompression-bomb guard (declared pixel dimensions)
 * ──────────────────────────────────────────────────────────────────────── */

function fakePngWithDimensions(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("assertPixelBudget", () => {
  it("accepts a normal-sized image", () => {
    expect(assertPixelBudget(fakePngWithDimensions(1920, 1080))).toEqual({ ok: true });
  });

  it("rejects a PNG that declares an enormous width/height (classic decompression bomb)", () => {
    const result = assertPixelBudget(fakePngWithDimensions(50_000, 50_000));
    expect(result.ok).toBe(false);
  });

  it("rejects an image within per-axis limits but over the total-megapixel budget", () => {
    const result = assertPixelBudget(fakePngWithDimensions(11_000, 11_000), {
      maxWidth: 12_000,
      maxHeight: 12_000,
      maxMegapixels: 40,
    });
    expect(result.ok).toBe(false);
  });

  it("lets through a format it can't header-sniff dimensions for (bounded elsewhere by byte size)", () => {
    expect(assertPixelBudget(Buffer.from("not a real image"))).toEqual({ ok: true });
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * SSRF guard
 * ──────────────────────────────────────────────────────────────────────── */

describe("checkImageUrlAllowed", () => {
  it("allows an https Pexels CDN URL", () => {
    expect(checkImageUrlAllowed("https://images.pexels.com/photos/1/photo.jpeg").ok).toBe(true);
  });

  it("allows an https fal.media CDN URL", () => {
    expect(checkImageUrlAllowed("https://v3.fal.media/files/abc.png").ok).toBe(true);
  });

  it("rejects plain http, even for an otherwise-allowed host", () => {
    expect(checkImageUrlAllowed("http://images.pexels.com/photos/1/photo.jpeg").ok).toBe(false);
  });

  it("rejects a host that is not on the allowlist", () => {
    expect(checkImageUrlAllowed("https://evil.example.com/pwn.png").ok).toBe(false);
  });

  it("rejects a lookalike host (allowlisted domain as a subdomain of the attacker's)", () => {
    // e.g. "pexels.com.evil.com" must NOT satisfy an endsWith(".pexels.com")-style check
    expect(checkImageUrlAllowed("https://pexels.com.evil.com/x.png").ok).toBe(false);
  });

  it("rejects an SSRF attempt against a raw internal/loopback address", () => {
    expect(checkImageUrlAllowed("https://127.0.0.1/admin").ok).toBe(false);
    expect(checkImageUrlAllowed("https://169.254.169.254/latest/meta-data/").ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(checkImageUrlAllowed("not a url at all").ok).toBe(false);
  });
});

describe("isPrivateOrReservedIp", () => {
  it("flags loopback, link-local/metadata, and RFC1918 ranges", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true); // cloud metadata
    expect(isPrivateOrReservedIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true); // CGNAT
  });

  it("flags IPv6 loopback and unique-local/link-local ranges", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd00::1")).toBe(true);
  });

  it("flags an IPv4-mapped-IPv6 private address", () => {
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows real public addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("2606:4700:4700::1111")).toBe(false);
  });

  it("treats a malformed address as unsafe (fail closed)", () => {
    expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
  });
});

describe("assertResolvesToPublicAddress", () => {
  it("rejects an IP-literal hostname that is private, without needing DNS", async () => {
    const result = await assertResolvesToPublicAddress("127.0.0.1");
    expect(result.ok).toBe(false);
  });

  it("accepts an IP-literal hostname that is public, without needing DNS", async () => {
    const result = await assertResolvesToPublicAddress("8.8.8.8");
    expect(result.ok).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * Malware-scan hook
 * ──────────────────────────────────────────────────────────────────────── */

describe("scanBufferForMalware", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reports scanned:false when no scanner is configured (documented, not silently 'clean')", async () => {
    delete process.env.MALWARE_SCAN_API_URL;
    const result = await scanBufferForMalware(Buffer.from("x"), "test");
    expect(result).toEqual({ scanned: false, reason: expect.any(String) });
  });

  it("returns clean:false when a configured scanner flags the file", async () => {
    process.env.MALWARE_SCAN_API_URL = "https://scanner.example.com/scan";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clean: false, signature: "EICAR-Test" }),
      }),
    );
    const result = await scanBufferForMalware(Buffer.from("x"), "test");
    expect(result).toEqual({ scanned: true, clean: false, signature: "EICAR-Test" });
  });

  it("returns clean:true when a configured scanner passes the file", async () => {
    process.env.MALWARE_SCAN_API_URL = "https://scanner.example.com/scan";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ clean: true }) }),
    );
    const result = await scanBufferForMalware(Buffer.from("x"), "test");
    expect(result).toEqual({ scanned: true, clean: true });
  });

  it("fails safe to scanned:false (not a crash, not a false 'clean') when the scanner errors", async () => {
    process.env.MALWARE_SCAN_API_URL = "https://scanner.example.com/scan";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await scanBufferForMalware(Buffer.from("x"), "test");
    expect(result.scanned).toBe(false);
  });

  it("fails safe to scanned:false when the scanner responds with a non-OK status", async () => {
    process.env.MALWARE_SCAN_API_URL = "https://scanner.example.com/scan";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const result = await scanBufferForMalware(Buffer.from("x"), "test");
    expect(result.scanned).toBe(false);
  });
});
