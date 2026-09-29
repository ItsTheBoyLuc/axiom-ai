// Generates favicon.ico (16/32/48, PNG-in-ICO) and apple-icon.png from src/app/icon.svg.
// Run: node scripts/generate-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('src/app/icon.svg');
const png = (size) => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));

// ICO container: header + directory entries + PNG payloads.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = images.map((img, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(img.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.length;
  return e;
});
await writeFile('src/app/favicon.ico', Buffer.concat([header, ...entries, ...images]));
await writeFile('src/app/apple-icon.png', await png(180));
console.log('favicon.ico and apple-icon.png written');
