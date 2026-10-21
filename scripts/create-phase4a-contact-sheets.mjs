import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.argv[2] ?? "artifacts/phase4a-title-starter");
const rendered = path.join(root, "rendered");
const output = path.join(root, "contact-sheets");
await fs.mkdir(output, { recursive: true });

function naturalSlideSort(left, right) {
  return Number(left.match(/\d+/)?.[0] ?? 0) - Number(right.match(/\d+/)?.[0] ?? 0);
}

async function slideFiles(deckName) {
  const directory = path.join(rendered, deckName);
  const names = (await fs.readdir(directory)).filter((name) => /^Slide\d+\.PNG$/i.test(name)).sort(naturalSlideSort);
  return names.map((name) => path.join(directory, name));
}

function labelSvg(label, width, height) {
  const safe = label.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#102A43"/><text x="18" y="31" font-family="Arial" font-size="20" font-weight="700" fill="#F7F5EF">${safe}</text></svg>`);
}

async function tile(imagePath, label, width = 480, height = 270) {
  const image = await sharp(imagePath).resize(width, height, { fit: "contain", background: "#F7F5EF" }).png().toBuffer();
  return sharp({ create: { width, height: height + 44, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: image, top: 44, left: 0 }, { input: labelSvg(label, width, 44), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function composeGrid(items, destination, columns) {
  const tileWidth = 480;
  const tileHeight = 314;
  const gap = 18;
  const rows = Math.ceil(items.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * tileHeight + (rows + 1) * gap;
  const layers = [];
  for (let index = 0; index < items.length; index += 1) {
    layers.push({
      input: await tile(items[index].path, items[index].label),
      left: gap + (index % columns) * (tileWidth + gap),
      top: gap + Math.floor(index / columns) * (tileHeight + gap),
    });
  }
  await sharp({ create: { width, height, channels: 4, background: "#EAF1F0" } }).composite(layers).png().toFile(destination);
}

for (const slug of ["water-cycle", "linear-equations", "industrial-revolution"]) {
  const phase4a = await slideFiles(`${slug}-phase4a`);
  const legacy = await slideFiles(`${slug}-legacy`);
  await composeGrid(phase4a.map((file, index) => ({ path: file, label: `Phase 4A - slide ${index + 1}` })), path.join(output, `${slug}-phase4a-contact-sheet.png`), 3);
  await composeGrid(legacy.map((file, index) => ({ path: file, label: `Legacy - slide ${index + 1}` })), path.join(output, `${slug}-legacy-contact-sheet.png`), 3);
  await composeGrid([
    { path: legacy[0], label: "Before - title" },
    { path: phase4a[0], label: "After - title hero" },
    { path: legacy[1], label: "Before - starter" },
    { path: phase4a[1], label: "After - visual prompt" },
  ], path.join(output, `${slug}-before-after.png`), 2);
}

const waterLegacy = await slideFiles("water-cycle-legacy");
const waterHero = await slideFiles("water-cycle-phase4a");
const waterFallback = await slideFiles("water-cycle-typography-activity");
await composeGrid([
  { path: waterLegacy[0], label: "Legacy title" },
  { path: waterHero[0], label: "Hero title" },
  { path: waterFallback[0], label: "Typography title" },
  { path: waterLegacy[1], label: "Legacy starter" },
  { path: waterHero[1], label: "Visual prompt starter" },
  { path: waterFallback[1], label: "Activity brief starter" },
], path.join(output, "water-cycle-layout-variant-comparison.png"), 3);

