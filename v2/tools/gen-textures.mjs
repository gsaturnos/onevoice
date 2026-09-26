#!/usr/bin/env node
// Generates the original screen-print raster textures used by the art pipeline:
// warm paper grain, a halftone dot tile, an ink-edge alpha mask, and a soft warm
// particle. Zero dependencies — a tiny PNG encoder over Node's built-in zlib — so
// the textures are fully original, deterministic, and repeatable in CI. Output:
// v2/public/art/tex/*.png. Re-run with `npm run gen-textures`.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/art/tex');
mkdirSync(OUT, { recursive: true });

// --- minimal PNG (RGBA, 8-bit) encoder ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function save(name, w, h, fn) {
  const buf = Buffer.alloc(w * h * 4);
  fn((x, y, r, g, b, a) => {
    const i = (y * w + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  });
  const png = encodePNG(w, h, buf);
  writeFileSync(join(OUT, name), png);
  console.log(`${name}  ${w}x${h}  ${(png.length / 1024).toFixed(1)} KB`);
}

// 1) Warm paper grain — subtle multiplicative fibre noise, tiles seamlessly.
save('paper.png', 256, 256, (put) => {
  const rnd = mulberry32(1337);
  const n = new Float32Array(256 * 256);
  for (let i = 0; i < n.length; i++) n[i] = rnd();
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      // blend a couple of octaves + faint horizontal fibres
      const a = n[y * 256 + x];
      const b = n[((y + 128) % 256) * 256 + ((x + 71) % 256)];
      const fibre = Math.sin(y * 0.6 + a * 3) * 0.03;
      const v = 0.5 + (a - 0.5) * 0.10 + (b - 0.5) * 0.05 + fibre;
      const g = Math.max(0, Math.min(1, v));
      // near-white warm tint; used as multiply overlay
      put(x, y, 255, 250, 240, Math.round(26 + (1 - g) * 40));
    }
});

// 2) Halftone dot tile — screen-print shading dots (alpha), 12px pitch.
save('halftone.png', 12, 12, (put) => {
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      const dx = x - 6, dy = y - 6;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = d < 2.4 ? 255 : d < 3.1 ? 120 : 0; // crisp dot with a soft ring
      put(x, y, 0, 0, 0, a);
    }
});

// 3) Ink-edge alpha — a rough noise mask for imperfect printed edges.
save('ink-edge.png', 128, 128, (put) => {
  const rnd = mulberry32(90210);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const speck = rnd();
      const a = speck > 0.82 ? Math.round((speck - 0.82) / 0.18 * 200) : 0;
      put(x, y, 20, 14, 10, a);
    }
});

// 4) Soft warm particle — radial spark for signal/propagation/cascade.
save('spark.png', 64, 64, (put) => {
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const dx = (x - 32) / 32, dy = (y - 32) / 32;
      const d = Math.sqrt(dx * dx + dy * dy);
      const f = Math.max(0, 1 - d);
      const a = Math.round(Math.pow(f, 2.2) * 255);
      put(x, y, 255, 226, 168, a);
    }
});

console.log('textures written to', OUT);
