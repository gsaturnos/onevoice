#!/usr/bin/env node
// Renders the kitchen-table cast (12 neighbours × 3 awareness states) into a sprite
// atlas + manifest for the runtime asset pipeline. The characters are authored as
// layered SVG in tools/lib/cast.mjs (the single source); this tool rasterises them
// through a headless Chromium into two atlas pages (1× and 2×) and writes
// public/art/characters.manifest.json (frame rects, the local-unit box each frame
// maps onto, per-character identity for the fallback, and attribution).
//
// DEV-ONLY (not run in CI): needs a Chromium via playwright-core. The generated
// atlas + manifest are committed, so the app and CI never need a browser.
//   PW_EXECUTABLE=/path/to/headless_shell \
//   NODE_PATH=/path/to/node_modules \
//   node tools/gen-characters.mjs
// All art is original; no third-party or remote assets.

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CAST, STATES, defs, buildBust } from './lib/cast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../public/art');
mkdirSync(OUT, { recursive: true });
const EXE = process.env.PW_EXECUTABLE || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

// atlas geometry — kept so 2× stays within the 2048² budget (1440×1800).
const CELL_W = 120, CELL_H = 150, COLS = 6;
// the local-unit box (matching the runtime Character coordinate system) each cell
// maps onto; aspect must equal the cell so sprites are not distorted.
const LOCAL = { x0: -72, y0: -116, w: 144, h: 180 };
const sc = CELL_W / LOCAL.w;                 // 0.8333 local→cell
const gx = -LOCAL.x0 * sc, gy = -LOCAL.y0 * sc;

const frames = {};
let i = 0;
for (const spec of CAST) {
  for (const state of STATES) {
    const col = i % COLS, row = Math.floor(i / COLS);
    frames[`${spec.id}.${state}`] = { x: col * CELL_W, y: row * CELL_H, w: CELL_W, h: CELL_H };
    i++;
  }
}
const ROWS = Math.ceil(i / COLS);
const PAGE_W = COLS * CELL_W, PAGE_H = ROWS * CELL_H;

// Build the atlas grid at an explicit pixel scale (deviceScaleFactor stays 1). Each
// page is therefore an EXACT multiple of the base layout, so a frame rect scaled by
// the page's `scale` lines up perfectly — the 2× page is a true 2× of the 1× page.
function buildHtml(scale) {
  const cw = CELL_W * scale, ch = CELL_H * scale;
  let j = 0, cells = '';
  for (const spec of CAST) {
    for (const state of STATES) {
      const col = j % COLS, row = Math.floor(j / COLS);
      cells += `<div style="position:absolute;left:${col * cw}px;top:${row * ch}px;width:${cw}px;height:${ch}px">
        <svg width="${cw}" height="${ch}" viewBox="0 0 ${CELL_W} ${CELL_H}">${defs()}<g transform="translate(${gx} ${gy}) scale(${sc})">${buildBust(spec, state)}</g></svg></div>`;
      j++;
    }
  }
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}
#atlas{position:relative;width:${PAGE_W * scale}px;height:${PAGE_H * scale}px}</style>
<div id="atlas">${cells}</div>`;
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const [tag, scale] of [['1x', 1], ['2x', 2]]) {
  const ctx = await browser.newContext({ viewport: { width: PAGE_W * scale, height: PAGE_H * scale }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(buildHtml(scale)), { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 400));
  // capture as transparent PNG, then re-encode to WebP in-page (keeps payload small)
  const pngBuf = await page.locator('#atlas').screenshot({ omitBackground: true });
  const webpDataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.9);
  }, pngBuf.toString('base64'));
  const webpBuf = Buffer.from(webpDataUrl.split(',')[1], 'base64');
  writeFileSync(join(OUT, `characters@${tag}.webp`), webpBuf);
  await ctx.close();
  console.log(`characters@${tag}.webp  ${PAGE_W * scale}x${PAGE_H * scale}  ${(webpBuf.length / 1024).toFixed(0)} KB`);
}
await browser.close();

const manifest = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  cell: { w: CELL_W, h: CELL_H },
  local: LOCAL,                 // local-unit box each frame maps onto
  anchor: { x: gx / CELL_W, y: gy / CELL_H }, // local origin as a fraction of the cell
  pages: { '1x': { src: 'characters@1x.webp', scale: 1 }, '2x': { src: 'characters@2x.webp', scale: 2 } },
  states: STATES,
  frames,
  characters: CAST.map((c) => ({
    id: c.id, role: c.role, age: c.age, mobility: c.mobility,
    // minimal shape hints so the procedural fallback can still vary by identity
    build: c.build, head: c.head, headwear: c.headwear, prop: c.prop,
  })),
  attribution: {
    title: 'One Voice — kitchen-table cast',
    author: 'One Voice project (original, generated)',
    license: 'CC0-1.0 (project-internal original art)',
    source: 'tools/lib/cast.mjs via tools/gen-characters.mjs',
    thirdParty: 'none',
  },
};
writeFileSync(join(OUT, 'characters.manifest.json'), JSON.stringify(manifest, null, 2));
console.log('characters.manifest.json  frames:', Object.keys(frames).length);
