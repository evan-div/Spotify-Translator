// Generates the tray template icon and the app icon (PNG) with no dependencies.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Signed distance to a rounded rectangle (negative inside).
const sdRoundRect = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

/** Renders shapes with 4x4 supersampling. `paint(u, v)` gets 0..1 coords and returns [r,g,b,a(0..1)]. */
function render(size, paint) {
  const out = Buffer.alloc(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [pr, pg, pb, pa] = paint((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      }
      const n = ss * ss;
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// Subtitle glyph: two lines of "text" (long over short), the app's motif.
const glyph = (u, v, thickness) => {
  const bar1 = sdRoundRect(u, v, 0.5, 0.42, 0.3, thickness, thickness);
  const bar2 = sdRoundRect(u, v, 0.5 - 0.06, 0.62, 0.21, thickness, thickness);
  return Math.min(bar1, bar2) < 0;
};

mkdirSync('resources', { recursive: true });

// Tray template (black + alpha; macOS tints it automatically).
for (const [size, name] of [[18, 'trayTemplate.png'], [36, 'trayTemplate@2x.png']]) {
  const data = render(size, (u, v) => {
    const frame = sdRoundRect(u, v, 0.5, 0.5, 0.46, 0.36, 0.16);
    const stroke = Math.abs(frame) < 0.045 * (18 / size + 0.6);
    return stroke || glyph(u, v, 0.05) ? [0, 0, 0, 1] : [0, 0, 0, 0];
  });
  writeFileSync(`resources/${name}`, png(size, data));
}

// App icon: macOS-style squircle-ish rounded square with a violet gradient.
const icon = render(1024, (u, v) => {
  const d = sdRoundRect(u, v, 0.5, 0.5, 0.4, 0.4, 0.18);
  if (d > 0) return [0, 0, 0, 0];
  if (glyph(u, v, 0.055)) return [255, 255, 255, 0.96];
  const t = (u + v) / 2;
  return [94 + (191 - 94) * t, 92 + (90 - 92) * t, 230 + (242 - 230) * t, 1];
});
writeFileSync('resources/icon.png', png(1024, icon));
console.log('Icons written to resources/');
