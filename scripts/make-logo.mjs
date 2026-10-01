// Builds public/ logo assets from the source artwork (white background -> transparent, trimmed, square).
// Usage: node scripts/make-logo.mjs <source-image>
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const src = process.argv[2] || 'brand/tutorix-logo-source.jpg';
mkdirSync('public', { recursive: true });

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const min = Math.min(r, g, b);
  // Near-white pixels fade to transparent (soft edge keeps anti-aliasing smooth).
  if (min > 235) data[i + 3] = 0;
  else if (min > 205) data[i + 3] = Math.round(((235 - min) / 30) * 255);
}

const trimmed = await sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
const meta = await sharp(trimmed).metadata();
const side = Math.round(Math.max(meta.width, meta.height) * 1.08);
const square = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: trimmed, gravity: 'center' }])
  .png()
  .toBuffer();

await sharp(square).resize(512, 512).png().toFile('public/logo.png');
await sharp(square).resize(192, 192).png().toFile('public/logo-192.png');
await sharp(square).resize(64, 64).png().toFile('public/favicon.png');

// Apple touch icon needs an opaque background.
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([{ input: await sharp(square).resize(150, 150).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('public/apple-touch-icon.png');

console.log('Logo assets written to public/');
