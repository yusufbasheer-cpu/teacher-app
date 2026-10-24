import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractGammaImagePreviews } from "./gamma-ppt-images";

describe("Gamma PPT image previews", () => {
  it("extracts only real embedded presentation images and respects the limit", async () => {
    const zip = new JSZip();
    zip.file("ppt/media/image1.png", new Uint8Array([137, 80, 78, 71]));
    zip.file("ppt/media/image2.jpeg", new Uint8Array([255, 216, 255]));
    zip.file("ppt/slides/slide1.xml", "<xml />");
    const blob = await zip.generateAsync({ type: "blob" });
    const previews = await extractGammaImagePreviews(blob, 1);
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatch(/^data:image\/png;base64,/);
  });
});
