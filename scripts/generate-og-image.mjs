// Regenerates public/og-image.png (1200x630) from the approved logo.
// Run: node scripts/generate-og-image.mjs
import sharp from "sharp";

const logo = await sharp("public/Logo.png").resize({ width: 760 }).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#f7f8f8" } })
  .composite([{ input: logo, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");
