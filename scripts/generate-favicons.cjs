// Generates favicon files using only Node.js built-ins (no extra packages).
// Output: src/app/favicon.ico (16+32px), public/favicon-{16,32}x{16,32}.png, public/apple-touch-icon.png
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG builder ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.allocUnsafe(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(w, h, pixelFn) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // 8-bit depth
  ihdr[9] = 6;  // RGBA
  // [10-12] = 0 (compression / filter / interlace)

  // Raw scanlines: 1 filter byte + 4 bytes per pixel
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixelFn(x, y, w, h);
      const i = y * (w * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO builder (PNG-in-ICO) ───────────────────────────────────────────────
function makeICO(images) {
  // images: [{ size: number, png: Buffer }]
  const count = images.length;
  const DIR_OFFSET = 6 + count * 16;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = DIR_OFFSET;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; // 0 = 256 in ICO spec
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0; e[3] = 0;            // color count / reserved
    e.writeUInt16LE(1, 4);         // planes
    e.writeUInt16LE(32, 6);        // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...images.map(i => i.png)]);
}

// ── Pixel function: teal rounded-rect with white "L" ──────────────────────
// Colors
const TEAL        = [0, 198, 167, 255]; // #00C6A7
const WHITE       = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function layahPixel(x, y, w, h) {
  const radius = Math.round(w * 0.19);
  const cx = x + 0.5, cy = y + 0.5;

  // Rounded-corner clip
  function inside() {
    if (cx < radius  && cy < radius)       return Math.hypot(cx - radius,       cy - radius)       < radius;
    if (cx > w-radius && cy < radius)       return Math.hypot(cx - (w - radius), cy - radius)       < radius;
    if (cx < radius  && cy > h - radius)    return Math.hypot(cx - radius,       cy - (h - radius)) < radius;
    if (cx > w-radius && cy > h - radius)   return Math.hypot(cx - (w - radius), cy - (h - radius)) < radius;
    return true;
  }
  if (!inside()) return TRANSPARENT;

  // Map pixel centre to 16-unit grid for the "L" design
  // Design:
  //   Vertical bar : grid-x ∈ [3.5, 6),  grid-y ∈ [2, 14)
  //   Horizontal bar: grid-x ∈ [3.5, 12), grid-y ∈ [11, 14)
  const gx = cx / w * 16;
  const gy = cy / h * 16;

  const inVertical   = gx >= 3.5 && gx < 6  && gy >= 2  && gy < 14;
  const inHorizontal = gx >= 3.5 && gx < 12 && gy >= 11 && gy < 14;

  return (inVertical || inHorizontal) ? WHITE : TEAL;
}

// ── Generate ───────────────────────────────────────────────────────────────
const ROOT   = path.join(__dirname, '..');
const APP    = path.join(ROOT, 'src', 'app');
const PUBLIC = path.join(ROOT, 'public');

const png16  = makePNG(16,  16,  layahPixel);
const png32  = makePNG(32,  32,  layahPixel);
const png180 = makePNG(180, 180, layahPixel);

const ico = makeICO([
  { size: 16, png: png16 },
  { size: 32, png: png32 },
]);

fs.writeFileSync(path.join(APP,    'favicon.ico'),          ico);
fs.writeFileSync(path.join(PUBLIC, 'favicon-16x16.png'),    png16);
fs.writeFileSync(path.join(PUBLIC, 'favicon-32x32.png'),    png32);
fs.writeFileSync(path.join(PUBLIC, 'apple-touch-icon.png'), png180);

console.log('✓ src/app/favicon.ico (16+32px)');
console.log('✓ public/favicon-16x16.png');
console.log('✓ public/favicon-32x32.png');
console.log('✓ public/apple-touch-icon.png (180×180)');
