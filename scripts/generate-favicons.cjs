// Generates every favicon from public/logo-mark.png (512x487, not square).
// The logo is padded to a square on a transparent background — never stretched.
//
// Output:
//   src/app/favicon.ico        16+32+48px  (Next links it automatically)
//   src/app/icon.png           32x32       (Next links it automatically)
//   src/app/apple-icon.png     180x180     (Next links it automatically)
//   public/favicon-16x16.png, public/favicon-32x32.png, public/apple-touch-icon.png
//
// Run: node scripts/generate-favicons.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const SOURCE = path.join(root, "public", "logo-mark.png");
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const square = (size) =>
  sharp(SOURCE).resize(size, size, { fit: "contain", background: CLEAR }).png({ compressionLevel: 9 }).toBuffer();

// ICO container with embedded PNG images (supported by every current browser).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const [p16, p32, p48, p180] = await Promise.all([16, 32, 48, 180].map(square));

  const out = {
    "src/app/favicon.ico": buildIco([
      { size: 16, data: p16 },
      { size: 32, data: p32 },
      { size: 48, data: p48 },
    ]),
    "src/app/icon.png": p32,
    "src/app/apple-icon.png": p180,
    "public/favicon-16x16.png": p16,
    "public/favicon-32x32.png": p32,
    "public/apple-touch-icon.png": p180,
  };

  for (const [rel, data] of Object.entries(out)) {
    fs.writeFileSync(path.join(root, rel), data);
    console.log(`wrote ${rel} (${data.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
