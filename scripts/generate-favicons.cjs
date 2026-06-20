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

// ── Pixel function: stacked diamond logo icon ─────────────────────────────
// Recreates the three stacked teal diamond (rotated rounded-square) shapes
// from the Layah logo. Uses L1-norm (Manhattan distance) for the diamond shape
// since a square rotated 45° is exactly an L1 ball.
//
// CSS reference (32×32 icon.tsx):
//   14×14 square, 2px border, rotated 45° → L1 outer-r=7, inner-r=5
//   Top diamond : center (18,11)  lightest teal
//   Mid diamond : center (16,16)  standard teal
//   Bot diamond : center (14,22)  darkest  teal

const NAVY        = [10, 22, 40, 255];   // #0A1628
const TRANSPARENT = [0, 0, 0, 0];

function layahPixel(x, y, w, h) {
  const px = x + 0.5, py = y + 0.5;

  // Rounded-corner clip (same as before)
  const radius = Math.round(w * 0.19);
  function insideRoundedRect() {
    if (px < radius  && py < radius)       return Math.hypot(px - radius,       py - radius)       < radius;
    if (px > w-radius && py < radius)       return Math.hypot(px - (w - radius), py - radius)       < radius;
    if (px < radius  && py > h - radius)    return Math.hypot(px - radius,       py - (h - radius)) < radius;
    if (px > w-radius && py > h - radius)   return Math.hypot(px - (w - radius), py - (h - radius)) < radius;
    return true;
  }
  if (!insideRoundedRect()) return TRANSPARENT;

  // Scale all coordinates from 32-unit reference to actual size
  const s = w / 32;

  // Diamonds in front-to-back order (top is frontmost)
  // r_outer = 7*s (half of 14px square, L1 radius)
  // r_inner = 5*s (r_outer minus 2px stroke width)
  const diamonds = [
    { cx: 18*s, cy: 11*s, ro: 7*s, ri: 5*s, color: [61, 219, 200, 255]  }, // top  #3DDBC8
    { cx: 16*s, cy: 16*s, ro: 7*s, ri: 5*s, color: [0, 198, 167, 255]   }, // mid  #00C6A7
    { cx: 14*s, cy: 22*s, ro: 7*s, ri: 5*s, color: [0, 158, 133, 255]   }, // bot  #009E85
  ];

  // For each pixel, find the frontmost diamond that contains it.
  // If on its edge → diamond color; if inside it → navy bg; outside all → navy bg.
  for (const d of diamonds) {
    const dist = Math.abs(px - d.cx) + Math.abs(py - d.cy);
    if (dist <= d.ro) {
      return dist >= d.ri ? d.color : NAVY;
    }
  }
  return NAVY;
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
