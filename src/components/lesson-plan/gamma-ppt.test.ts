import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractGammaSlidePreviews } from "./gamma-ppt-images";

describe("Gamma PPT image previews", () => {
  it("keeps exported text and each real image attached to its physical slide", async () => {
    const zip = new JSZip();
    zip.file("ppt/media/image1.png", new Uint8Array([137, 80, 78, 71]));
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a" xmlns:r="r"><a:t>Plants around us</a:t><a:t>Observe three leaves.</a:t><a:blip r:embed="rId2" /></p:sld>');
    zip.file("ppt/slides/_rels/slide1.xml.rels", '<Relationships><Relationship Id="rId2" Target="../media/image1.png" /></Relationships>');
    zip.file("ppt/slides/slide2.xml", '<p:sld xmlns:a="a"><a:t>Explain your finding</a:t></p:sld>');
    const blob = await zip.generateAsync({ type: "blob" });
    const previews = await extractGammaSlidePreviews(blob);
    expect(previews).toHaveLength(2);
    expect(previews[0]).toMatchObject({ title: "Plants around us", lines: ["Observe three leaves."] });
    expect(previews[0]?.imagePreview).toMatch(/^data:image\/png;base64,/);
    expect(previews[1]).toEqual({ title: "Explain your finding", lines: [] });
  });
});
